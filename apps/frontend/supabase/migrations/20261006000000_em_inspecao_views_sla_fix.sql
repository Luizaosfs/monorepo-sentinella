-- 20261006000000_em_inspecao_views_sla_fix.sql
-- Corrige views, funções e contadores que não consideravam o estado em_inspecao.
--
-- Mudanças:
-- 1. v_central_operacional  — focos_pendentes inclui em_inspecao
-- 2. fn_calcular_score_imovel — v_focos_ativos inclui em_inspecao
-- 3. v_imoveis_para_hoje — já está correto (usa NOT IN resolvido/descartado),
--    apenas comentado para rastreabilidade

-- ── 1. v_central_operacional ──────────────────────────────────────────────────
-- Antes: focos_pendentes = suspeita + em_triagem + aguarda_inspecao
-- Depois: focos_pendentes inclui em_inspecao (foco ainda não confirmado/descartado)
-- Mantém subconsultas escalares (20260921) — sem produto cartesiano; mesmas colunas que o deploy atual.

CREATE OR REPLACE VIEW public.v_central_operacional
WITH (security_invoker = true) AS
SELECT
  u.cliente_id,
  CURRENT_DATE AS data_ref,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.status IN ('suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao')
      AND fr.deleted_at IS NULL
  ) AS focos_pendentes,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.status IN ('confirmado', 'em_tratamento')
      AND fr.deleted_at IS NULL
  ) AS focos_em_atendimento,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.prioridade = 'P1'
      AND fr.responsavel_id IS NULL
      AND fr.status NOT IN ('resolvido', 'descartado')
      AND fr.deleted_at IS NULL
  ) AS focos_p1_sem_agente,
  (
    SELECT COUNT(*)::bigint
    FROM public.sla_operacional sla
    WHERE sla.cliente_id = u.cliente_id
      AND sla.status = 'vencido'
      AND sla.violado = true
      AND sla.deleted_at IS NULL
  ) AS slas_vencidos,
  (
    SELECT COUNT(*)::bigint
    FROM public.sla_operacional sla
    WHERE sla.cliente_id = u.cliente_id
      AND sla.status IN ('pendente', 'em_atendimento')
      AND sla.prazo_final <= now() + interval '2 hours'
      AND sla.prazo_final > now()
      AND sla.deleted_at IS NULL
  ) AS slas_vencendo_2h,
  (
    SELECT COUNT(*)::bigint
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
      AND ts.classificacao = 'critico'
  ) AS imoveis_criticos,
  (
    SELECT COUNT(*)::bigint
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
      AND ts.classificacao = 'muito_alto'
  ) AS imoveis_muito_alto,
  (
    SELECT ROUND(AVG(ts.score), 1)
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
  ) AS score_medio_municipio,
  (
    SELECT COUNT(*)::bigint
    FROM public.vistorias v
    WHERE v.cliente_id = u.cliente_id
      AND (v.created_at)::date = CURRENT_DATE
      AND v.deleted_at IS NULL
  ) AS vistorias_hoje,
  (
    SELECT COUNT(DISTINCT v.agente_id)::bigint
    FROM public.vistorias v
    WHERE v.cliente_id = u.cliente_id
      AND (v.created_at)::date = CURRENT_DATE
      AND v.deleted_at IS NULL
  ) AS agentes_ativos_hoje,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr2
    WHERE fr2.cliente_id = u.cliente_id
      AND fr2.origem_tipo = 'cidadao'
      AND fr2.status NOT IN ('resolvido', 'descartado')
      AND fr2.created_at >= now() - interval '24 hours'
      AND fr2.deleted_at IS NULL
  ) AS denuncias_ultimas_24h,
  (
    SELECT COUNT(*)::bigint
    FROM public.casos_notificados cn
    WHERE cn.cliente_id = u.cliente_id
      AND (cn.created_at)::date = CURRENT_DATE
      AND cn.deleted_at IS NULL
  ) AS casos_hoje
FROM public.usuarios u
WHERE u.auth_id = auth.uid();

GRANT SELECT ON public.v_central_operacional TO authenticated;
COMMENT ON VIEW public.v_central_operacional IS
  'KPIs do dia para a Central Operacional. Um row por usuário logado. security_invoker garante isolamento multitenante. focos_pendentes inclui em_inspecao (fix 20261006).';

-- ── 2. fn_calcular_score_imovel ───────────────────────────────────────────────
-- Antes: v_focos_ativos = suspeita + em_triagem + aguarda_inspecao
-- Depois: inclui em_inspecao — imóvel com inspeção ativa mantém score elevado

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
  -- Buscar configuração do cliente (usa defaults se não existir)
  SELECT * INTO v_cfg FROM public.score_config WHERE cliente_id = p_cliente_id;
  IF NOT FOUND THEN
    INSERT INTO public.score_config (cliente_id) VALUES (p_cliente_id)
    ON CONFLICT (cliente_id) DO NOTHING;
    SELECT * INTO v_cfg FROM public.score_config WHERE cliente_id = p_cliente_id;
  END IF;

  -- Focos ativos (suspeita + em_triagem + aguarda_inspecao + em_inspecao)
  SELECT COUNT(*) INTO v_focos_ativos
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND status IN ('suspeita','em_triagem','aguarda_inspecao','em_inspecao') AND deleted_at IS NULL;

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
  'Calcula e persiste o score territorial de um imóvel (0–100). focos_ativos inclui em_inspecao (fix 20261006).';
