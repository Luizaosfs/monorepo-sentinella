-- =============================================================================
-- 1F: Adicionar verificação de tenant em funções SECURITY DEFINER
--
-- Problema A: fn_calcular_score_imovel(p_imovel_id, p_cliente_id)
--   Chamada por usuários autenticados sem verificar se o caller pertence ao cliente.
--   Um usuário de cliente A poderia calcular/sobrescrever scores do cliente B.
--
-- Problema B: resumo_agente_ciclo(p_cliente_id, p_agente_id, p_ciclo)
--   Sem verificação de tenant: qualquer usuário autenticado lê dados de qualquer cliente.
--   v_total conta TODOS os imóveis do cliente em vez dos quarteirões atribuídos ao agente.
--
-- Fix A: adicionar guard — auth.uid() authenticated → exige usuario_pode_acessar_cliente().
--        service_role (Edge Function score-worker) passa com auth.uid() IS NULL.
-- Fix B: tenant check + v_total via distribuicao_quarteirao (fallback para todos se sem atribuição).
-- =============================================================================

-- ── A. fn_calcular_score_imovel — adicionar tenant check ─────────────────────

CREATE OR REPLACE FUNCTION public.fn_calcular_score_imovel(
  p_imovel_id  uuid,
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg           public.score_config%ROWTYPE;
  v_score         numeric := 0;
  v_pontos_focos  numeric := 0;
  v_pontos_epidem numeric := 0;
  v_pontos_hist   numeric := 0;
  v_fatores       jsonb   := '{}';
  v_focos_ativos      int;
  v_focos_confirmados int;
  v_focos_recorrentes int;
  v_focos_historico   int;
  v_focos_resolvidos  int;
  v_casos_proximos    int;
  v_chuva_alta        bool := false;
  v_temp_alta         bool := false;
  v_denuncia_cidadao  int;
  v_recusa            bool := false;
  v_sla_vencido       int;
  v_vistoria_negativa bool := false;
  v_class             text;
BEGIN
  -- FIX 1F-A: tenant check — service_role (auth.uid() IS NULL) é confiável;
  -- usuários autenticados devem pertencer ao cliente.
  IF auth.uid() IS NOT NULL AND NOT usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao cliente %', p_cliente_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Buscar configuração do cliente (seed automático se não existir)
  SELECT * INTO v_cfg FROM public.score_config WHERE cliente_id = p_cliente_id;
  IF NOT FOUND THEN
    INSERT INTO public.score_config (cliente_id) VALUES (p_cliente_id)
    ON CONFLICT (cliente_id) DO NOTHING;
    SELECT * INTO v_cfg FROM public.score_config WHERE cliente_id = p_cliente_id;
  END IF;

  -- Focos ativos (suspeita + em_triagem + aguarda_inspecao)
  SELECT COUNT(*) INTO v_focos_ativos
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND status IN ('suspeita','em_triagem','aguarda_inspecao') AND deleted_at IS NULL;

  -- Focos confirmados / em tratamento
  SELECT COUNT(*) INTO v_focos_confirmados
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND status IN ('confirmado','em_tratamento') AND deleted_at IS NULL;

  -- Focos recorrentes (tem foco_anterior_id)
  SELECT COUNT(*) INTO v_focos_recorrentes
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND foco_anterior_id IS NOT NULL
    AND status NOT IN ('resolvido','descartado') AND deleted_at IS NULL;

  -- Histórico total de focos no imóvel
  SELECT COUNT(*) INTO v_focos_historico
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id AND deleted_at IS NULL;

  -- Focos resolvidos recentemente (reduz score)
  SELECT COUNT(*) INTO v_focos_resolvidos
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND status = 'resolvido'
    AND resolvido_em >= now() - (v_cfg.janela_resolucao_dias || ' days')::interval
    AND deleted_at IS NULL;

  -- Calcular pontos de focos (com cap)
  v_pontos_focos :=
    (v_focos_ativos      * v_cfg.peso_foco_suspeito) +
    (v_focos_confirmados * v_cfg.peso_foco_confirmado) +
    (v_focos_recorrentes * v_cfg.peso_foco_recorrente);
  v_pontos_focos := LEAST(v_pontos_focos, v_cfg.cap_focos);

  -- Histórico de 3+ focos
  IF v_focos_historico >= 3 THEN
    v_pontos_hist := v_pontos_hist + v_cfg.peso_historico_3focos;
  END IF;
  v_pontos_hist := LEAST(v_pontos_hist, v_cfg.cap_historico);

  -- Casos notificados em raio de 300m
  SELECT COUNT(*) INTO v_casos_proximos
  FROM public.casos_notificados cn
  JOIN public.imoveis im ON im.id = p_imovel_id
  WHERE cn.cliente_id = p_cliente_id
    AND cn.status IN ('suspeito','confirmado')
    AND cn.created_at >= now() - (v_cfg.janela_caso_dias || ' days')::interval
    AND im.latitude IS NOT NULL AND im.longitude IS NOT NULL
    AND cn.latitude IS NOT NULL AND cn.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(im.longitude, im.latitude)::geography,
      ST_MakePoint(cn.longitude, cn.latitude)::geography,
      300
    );

  -- Dados climáticos mais recentes do bairro
  SELECT
    COALESCE(poi.chuva_7d_mm, 0) > 60,
    COALESCE(poi.temp_media_c, 0) > 30
  INTO v_chuva_alta, v_temp_alta
  FROM public.pluvio_operacional_item poi
  JOIN public.pluvio_operacional_run por ON por.id = poi.run_id
  JOIN public.imoveis im ON im.id = p_imovel_id
  WHERE poi.cliente_id = p_cliente_id
    AND (poi.bairro_nome = im.bairro OR poi.regiao_id = im.regiao_id)
  ORDER BY por.created_at DESC
  LIMIT 1;

  -- Denúncias de cidadão ativas no imóvel
  SELECT COUNT(*) INTO v_denuncia_cidadao
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND origem_tipo = 'cidadao'
    AND status NOT IN ('resolvido','descartado') AND deleted_at IS NULL;

  -- SLA vencido sem resolução
  SELECT COUNT(*) INTO v_sla_vencido
  FROM public.sla_operacional sla
  JOIN public.focos_risco fr ON fr.id = sla.foco_risco_id
  WHERE fr.imovel_id = p_imovel_id
    AND sla.cliente_id = p_cliente_id
    AND sla.violado = true
    AND sla.deleted_at IS NULL;

  -- Histórico de recusa do imóvel
  SELECT COALESCE(historico_recusa, false) INTO v_recusa
  FROM public.imoveis WHERE id = p_imovel_id;

  -- Vistoria negativa recente (sem foco)
  SELECT EXISTS (
    SELECT 1 FROM public.vistorias v
    WHERE v.imovel_id = p_imovel_id AND v.cliente_id = p_cliente_id
      AND v.acesso_realizado = true
      AND v.created_at >= now() - (v_cfg.janela_vistoria_dias || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.vistoria_depositos vd
        WHERE vd.vistoria_id = v.id AND vd.qtd_com_focos > 0
      )
  ) INTO v_vistoria_negativa;

  -- Calcular pontos epidemiológicos (com cap)
  v_pontos_epidem :=
    LEAST(v_casos_proximos, 2) * v_cfg.peso_caso_300m +
    CASE WHEN v_chuva_alta  THEN v_cfg.peso_chuva_alta     ELSE 0 END +
    CASE WHEN v_temp_alta   THEN v_cfg.peso_temperatura_30  ELSE 0 END +
    LEAST(v_denuncia_cidadao, 2) * v_cfg.peso_denuncia_cidadao +
    CASE WHEN v_recusa      THEN v_cfg.peso_imovel_recusa   ELSE 0 END +
    LEAST(v_sla_vencido, 2) * v_cfg.peso_sla_vencido;
  v_pontos_epidem := LEAST(v_pontos_epidem, v_cfg.cap_epidemio);

  -- Score bruto
  v_score := v_pontos_focos + v_pontos_hist + v_pontos_epidem;

  -- Subtrações
  v_score := v_score
    + LEAST(v_focos_resolvidos, 3) * v_cfg.peso_foco_resolvido
    + CASE WHEN v_vistoria_negativa THEN v_cfg.peso_vistoria_negativa ELSE 0 END;

  -- Clamp final: 0–100
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Classificação
  v_class := CASE
    WHEN v_score >= 81 THEN 'critico'
    WHEN v_score >= 61 THEN 'muito_alto'
    WHEN v_score >= 41 THEN 'alto'
    WHEN v_score >= 21 THEN 'medio'
    ELSE 'baixo'
  END;

  -- Fatores (breakdown para exibição ao gestor)
  v_fatores := jsonb_build_object(
    'focos_ativos',              v_focos_ativos,
    'focos_confirmados',         v_focos_confirmados,
    'focos_recorrentes',         v_focos_recorrentes,
    'focos_historico',           v_focos_historico,
    'focos_resolvidos_recentes', v_focos_resolvidos,
    'casos_proximos',            v_casos_proximos,
    'chuva_alta',                v_chuva_alta,
    'temp_alta',                 v_temp_alta,
    'denuncia_cidadao',          v_denuncia_cidadao,
    'imovel_recusa',             v_recusa,
    'sla_vencido',               v_sla_vencido,
    'vistoria_negativa',         v_vistoria_negativa,
    'pontos_focos',              v_pontos_focos,
    'pontos_epidem',             v_pontos_epidem,
    'pontos_hist',               v_pontos_hist
  );

  -- Upsert do cache
  INSERT INTO public.territorio_score (
    cliente_id, imovel_id, score, classificacao, fatores, calculado_em, versao_config
  ) VALUES (
    p_cliente_id, p_imovel_id, v_score, v_class, v_fatores, now(), v_cfg.updated_at
  )
  ON CONFLICT (cliente_id, imovel_id)
  DO UPDATE SET
    score         = EXCLUDED.score,
    classificacao = EXCLUDED.classificacao,
    fatores       = EXCLUDED.fatores,
    calculado_em  = EXCLUDED.calculado_em,
    versao_config = EXCLUDED.versao_config;

  RETURN jsonb_build_object('score', v_score, 'classificacao', v_class, 'fatores', v_fatores);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_calcular_score_imovel(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.fn_calcular_score_imovel(uuid, uuid) IS
  'Calcula e persiste o score territorial de um imóvel (0–100). '
  'Chamada pela Edge Function score-worker (service_role) ou por usuário autenticado do cliente. '
  'Fix 1F: tenant check via usuario_pode_acessar_cliente() para callers autenticados.';

-- ── B. resumo_agente_ciclo — tenant check + v_total por quarteirão atribuído ──

CREATE OR REPLACE FUNCTION resumo_agente_ciclo(
  p_cliente_id  uuid,
  p_agente_id   uuid,
  p_ciclo       int
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     int;
  v_visitados int;
  v_pendentes int;
BEGIN
  -- FIX 1F-B: tenant check — agente só pode consultar seu próprio resumo dentro do cliente.
  IF NOT usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao cliente %', p_cliente_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- FIX 2B: v_total via quarteirões atribuídos ao agente neste ciclo.
  -- Se não há distribuição registrada, cai no total de imóveis do cliente (comportamento anterior).
  SELECT COUNT(DISTINCT im.id) INTO v_total
  FROM public.imoveis im
  JOIN public.distribuicao_quarteirao dq
    ON dq.quarteirao  = im.quarteirao
   AND dq.agente_id   = p_agente_id
   AND dq.ciclo       = p_ciclo
   AND dq.cliente_id  = p_cliente_id
  WHERE im.cliente_id = p_cliente_id AND im.ativo = true;

  -- Fallback: agente sem distribuição registrada → total do cliente
  IF v_total = 0 THEN
    SELECT COUNT(*) INTO v_total
    FROM public.imoveis
    WHERE cliente_id = p_cliente_id AND ativo = true;
  END IF;

  SELECT COUNT(*) INTO v_visitados
  FROM public.vistorias
  WHERE cliente_id = p_cliente_id
    AND agente_id  = p_agente_id
    AND ciclo      = p_ciclo
    AND status     IN ('visitado','fechado');

  v_pendentes := GREATEST(v_total - v_visitados, 0);

  RETURN json_build_object(
    'pendentes',     v_pendentes,
    'visitados',     v_visitados,
    'meta',          v_total,
    'cobertura_pct', CASE WHEN v_total > 0
                       THEN ROUND((v_visitados::numeric / v_total) * 100, 1)
                       ELSE 0
                     END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION resumo_agente_ciclo(uuid, uuid, int) TO authenticated;
COMMENT ON FUNCTION resumo_agente_ciclo(uuid, uuid, int) IS
  'Resumo de produtividade do agente num ciclo: pendentes, visitados, meta, cobertura%. '
  'Fix 1F: tenant check obrigatório. Fix 2B: v_total usa distribuicao_quarteirao (fallback para todos se sem atribuição).';
