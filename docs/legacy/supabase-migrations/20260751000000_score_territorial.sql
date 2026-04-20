-- =============================================================================
-- Score Territorial de Risco
-- Arquitetura de cache assíncrono: triggers apenas enfileiram, nunca calculam.
-- O cálculo real ocorre na Edge Function score-worker que processa a job_queue.
-- =============================================================================

-- 1. Configuração de pesos por cliente
CREATE TABLE IF NOT EXISTS public.score_config (
  cliente_id              uuid        PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
  peso_foco_suspeito      int         NOT NULL DEFAULT 10,
  peso_foco_confirmado    int         NOT NULL DEFAULT 25,
  peso_foco_em_tratamento int         NOT NULL DEFAULT 20,
  peso_foco_recorrente    int         NOT NULL DEFAULT 35,
  peso_historico_3focos   int         NOT NULL DEFAULT 15,
  peso_caso_300m          int         NOT NULL DEFAULT 25,
  peso_chuva_alta         int         NOT NULL DEFAULT 10,
  peso_temperatura_30     int         NOT NULL DEFAULT 8,
  peso_denuncia_cidadao   int         NOT NULL DEFAULT 10,
  peso_imovel_recusa      int         NOT NULL DEFAULT 8,
  peso_sla_vencido        int         NOT NULL DEFAULT 12,
  peso_foco_resolvido     int         NOT NULL DEFAULT -15,
  peso_vistoria_negativa  int         NOT NULL DEFAULT -8,
  janela_resolucao_dias   int         NOT NULL DEFAULT 30,
  janela_vistoria_dias    int         NOT NULL DEFAULT 45,
  janela_caso_dias        int         NOT NULL DEFAULT 60,
  cap_focos               int         NOT NULL DEFAULT 40,
  cap_epidemio            int         NOT NULL DEFAULT 30,
  cap_historico           int         NOT NULL DEFAULT 20,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.score_config IS
  'Pesos e janelas temporais do Score Territorial por cliente.';

ALTER TABLE public.score_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_config_select" ON public.score_config
  FOR SELECT TO authenticated USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
  );
CREATE POLICY "score_config_upsert" ON public.score_config
  FOR ALL TO authenticated
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()))
  WITH CHECK (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

-- Seed automático ao criar cliente
CREATE OR REPLACE FUNCTION fn_seed_score_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.score_config (cliente_id) VALUES (NEW.id)
  ON CONFLICT (cliente_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_score_config ON public.clientes;
CREATE TRIGGER trg_seed_score_config
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION fn_seed_score_config();

-- Backfill para clientes existentes
INSERT INTO public.score_config (cliente_id)
SELECT id FROM public.clientes WHERE deleted_at IS NULL
ON CONFLICT (cliente_id) DO NOTHING;

-- 2. Tabela de cache do score por imóvel
CREATE TABLE IF NOT EXISTS public.territorio_score (
  cliente_id      uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  imovel_id       uuid        NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  score           numeric(5,2) NOT NULL DEFAULT 0
                    CONSTRAINT score_range CHECK (score BETWEEN 0 AND 100),
  classificacao   text        NOT NULL DEFAULT 'baixo'
                    CONSTRAINT classificacao_valida
                    CHECK (classificacao IN ('baixo','medio','alto','muito_alto','critico')),
  fatores         jsonb       NOT NULL DEFAULT '{}',
  calculado_em    timestamptz NOT NULL DEFAULT now(),
  versao_config   timestamptz,
  PRIMARY KEY (cliente_id, imovel_id)
);

COMMENT ON TABLE public.territorio_score IS
  'Cache do Score Territorial por imóvel (0–100). Recalculado assincronamente via job_queue → Edge Function score-worker.';

ALTER TABLE public.territorio_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "territorio_score_select" ON public.territorio_score
  FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX idx_score_imovel     ON public.territorio_score (imovel_id);
CREATE INDEX idx_score_cliente_sc ON public.territorio_score (cliente_id, score DESC);
CREATE INDEX idx_score_classif    ON public.territorio_score (cliente_id, classificacao)
  WHERE classificacao IN ('muito_alto', 'critico');

-- 3. View: score por bairro
CREATE OR REPLACE VIEW public.v_score_bairro
WITH (security_invoker = true) AS
SELECT
  ts.cliente_id,
  im.bairro,
  im.regiao_id,
  COUNT(*)                                                                      AS imoveis_com_score,
  ROUND(AVG(ts.score), 1)                                                       AS score_medio,
  MAX(ts.score)                                                                 AS score_maximo,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ts.score)                        AS score_p75,
  COUNT(*) FILTER (WHERE ts.classificacao IN ('muito_alto','critico'))           AS imoveis_criticos,
  COUNT(*) FILTER (WHERE ts.classificacao = 'alto')                             AS imoveis_alto,
  MAX(ts.calculado_em)                                                          AS ultimo_calculo
FROM public.territorio_score ts
JOIN public.imoveis im ON im.id = ts.imovel_id AND im.deleted_at IS NULL
GROUP BY ts.cliente_id, im.bairro, im.regiao_id;

GRANT SELECT ON public.v_score_bairro TO authenticated;

-- 4. View: score por quarteirão
CREATE OR REPLACE VIEW public.v_score_quarteirao
WITH (security_invoker = true) AS
SELECT
  ts.cliente_id,
  im.bairro,
  im.quarteirao,
  COUNT(*)                                                                      AS imoveis_com_score,
  ROUND(AVG(ts.score), 1)                                                       AS score_medio,
  MAX(ts.score)                                                                 AS score_maximo,
  COUNT(*) FILTER (WHERE ts.classificacao IN ('muito_alto','critico'))           AS imoveis_criticos,
  MAX(ts.calculado_em)                                                          AS ultimo_calculo
FROM public.territorio_score ts
JOIN public.imoveis im ON im.id = ts.imovel_id AND im.deleted_at IS NULL
WHERE im.quarteirao IS NOT NULL
GROUP BY ts.cliente_id, im.bairro, im.quarteirao;

GRANT SELECT ON public.v_score_quarteirao TO authenticated;

-- 5. Função de cálculo do score de um imóvel (chamada pela Edge Function)
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
  'Calcula e persiste o score territorial de um imóvel (0–100). Chamada pela Edge Function score-worker.';

-- 6. Trigger enfileirador — APENAS enfileira, nunca calcula
-- IMPORTANT: job_queue has NO cliente_id column — store in payload only
CREATE OR REPLACE FUNCTION public.fn_enfileirar_score_imovel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imovel_id  uuid;
  v_cliente_id uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'focos_risco' THEN
      v_imovel_id  := NEW.imovel_id;
      v_cliente_id := NEW.cliente_id;
    WHEN 'vistorias' THEN
      SELECT im.id, im.cliente_id INTO v_imovel_id, v_cliente_id
      FROM public.imoveis im WHERE im.id = NEW.imovel_id;
    WHEN 'casos_notificados' THEN
      INSERT INTO public.job_queue (tipo, status, payload)
      VALUES (
        'recalcular_score_por_caso',
        'pendente',
        jsonb_build_object(
          'caso_id',    NEW.id,
          'latitude',   NEW.latitude,
          'longitude',  NEW.longitude,
          'cliente_id', NEW.cliente_id,
          'raio_m',     300
        )
      );
      RETURN NEW;
  END CASE;

  IF v_imovel_id IS NULL OR v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.job_queue (tipo, status, payload)
  VALUES (
    'recalcular_score_imovel',
    'pendente',
    jsonb_build_object('imovel_id', v_imovel_id, 'cliente_id', v_cliente_id)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Índice único para deduplicação de jobs pendentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_score_dedup
  ON public.job_queue ((payload->>'imovel_id'))
  WHERE tipo = 'recalcular_score_imovel' AND status = 'pendente';

-- Triggers
DROP TRIGGER IF EXISTS trg_score_foco ON public.focos_risco;
DROP TRIGGER IF EXISTS trg_score_vistoria ON public.vistorias;
DROP TRIGGER IF EXISTS trg_score_caso ON public.casos_notificados;

CREATE TRIGGER trg_score_foco
  AFTER INSERT OR UPDATE OF status, prioridade ON public.focos_risco
  FOR EACH ROW WHEN (NEW.imovel_id IS NOT NULL)
  EXECUTE FUNCTION fn_enfileirar_score_imovel();

CREATE TRIGGER trg_score_vistoria
  AFTER INSERT ON public.vistorias
  FOR EACH ROW WHEN (NEW.imovel_id IS NOT NULL AND NEW.acesso_realizado = true)
  EXECUTE FUNCTION fn_enfileirar_score_imovel();

CREATE TRIGGER trg_score_caso
  AFTER INSERT ON public.casos_notificados
  FOR EACH ROW WHEN (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL)
  EXECUTE FUNCTION fn_enfileirar_score_imovel();

-- Cron: recálculo diário completo (captura mudanças climáticas)
-- Executar às 07:00 UTC (04:00 BRT) todo dia
DO $$
BEGIN
  PERFORM cron.schedule(
    'score-recalculo-diario',
    '0 7 * * *',
    $cron$
      INSERT INTO public.job_queue (tipo, status, payload)
      SELECT 'recalcular_score_lote', 'pendente',
             jsonb_build_object('cliente_id', id, 'motivo', 'cron_diario')
      FROM public.clientes WHERE deleted_at IS NULL AND ativo = true
      ON CONFLICT DO NOTHING;
    $cron$
  );
EXCEPTION WHEN others THEN NULL; -- pg_cron pode não estar disponível em dev
END;
$$;
