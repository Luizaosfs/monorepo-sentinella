-- ═══════════════════════════════════════════════════════════════════════════════
-- IA Pilot — Resumo Executivo + Score de Prioridade
-- 20261019000000_ia_pilot.sql
--
-- Entregas:
--   1. Tabela ia_insights — cache de respostas IA (24h) por cliente/tipo
--   2. Coluna focos_risco.score_prioridade integer — score calculado por foco
--   3. Função calcular_score_prioridade_foco(uuid) — SLA + reincidência + casos
--   4. Trigger trg_recalcular_score_prioridade — atualiza score após mudança de estado
--   5. Backfill de focos ativos existentes
--   6. Recriação de v_focos_risco_ativos e v_focos_risco_todos para incluir
--      a nova coluna score_prioridade via fr.*
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela ia_insights ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ia_insights (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo        text        NOT NULL,
  texto       text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  modelo      text        NOT NULL DEFAULT 'claude-haiku',
  tokens_in   integer,
  tokens_out  integer,
  valido_ate  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ia_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_insights_select"
  ON public.ia_insights FOR SELECT
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX IF NOT EXISTS idx_ia_insights_cliente_tipo
  ON public.ia_insights (cliente_id, tipo, created_at DESC);

COMMENT ON TABLE public.ia_insights IS
  'Cache de respostas geradas por IA (Claude Haiku) por cliente e tipo. '
  'valido_ate controla TTL — a edge function verifica antes de regenerar. '
  'Tipos conhecidos: resumo_diario. Piloto IA — 20261019000000.';

-- ── 2. Coluna score_prioridade em focos_risco ─────────────────────────────────

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS score_prioridade integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_focos_risco_score_prioridade
  ON public.focos_risco (cliente_id, score_prioridade DESC)
  WHERE status NOT IN ('resolvido', 'descartado');

COMMENT ON COLUMN public.focos_risco.score_prioridade IS
  'Score inteiro de prioridade calculado automaticamente. '
  'Componentes: SLA inteligente (10–50), reincidência (+20), casos próximos (+5/caso, max 30). '
  'Atualizado por trg_recalcular_score_prioridade. Zerado ao encerrar.';

-- ── 3. Função de cálculo de score ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calcular_score_prioridade_foco(p_foco_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_score        integer := 0;
  v_foco         record;
  v_prazo_min    integer;
  v_tempo_min    integer;
  v_sla_status   text;
  v_casos_count  integer := 0;
BEGIN
  -- Dados básicos do foco
  SELECT cliente_id, status, foco_anterior_id, latitude, longitude
  INTO v_foco
  FROM public.focos_risco
  WHERE id = p_foco_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- ── SLA Inteligente: busca prazo da fase atual ────────────────────────────
  SELECT prazo_minutos
  INTO v_prazo_min
  FROM public.sla_foco_config
  WHERE cliente_id = v_foco.cliente_id
    AND ativo = true
    AND fase = CASE v_foco.status
      WHEN 'suspeita'         THEN 'triagem'
      WHEN 'em_triagem'       THEN 'triagem'
      WHEN 'aguarda_inspecao' THEN 'triagem'
      WHEN 'em_inspecao'      THEN 'inspecao'
      WHEN 'confirmado'       THEN 'confirmacao'
      WHEN 'em_tratamento'    THEN 'tratamento'
      ELSE NULL
    END;

  -- Tempo no estado atual (minutos desde última transição registrada)
  SELECT EXTRACT(EPOCH FROM (now() - MAX(alterado_em)))::integer / 60
  INTO v_tempo_min
  FROM public.foco_risco_historico
  WHERE foco_risco_id = p_foco_id;

  -- Classificar status SLA
  IF v_prazo_min IS NOT NULL AND v_prazo_min > 0 AND v_tempo_min IS NOT NULL THEN
    v_sla_status := CASE
      WHEN v_tempo_min > v_prazo_min                   THEN 'vencido'
      WHEN v_tempo_min >= v_prazo_min * 0.9            THEN 'critico'
      WHEN v_tempo_min >= v_prazo_min * 0.7            THEN 'atencao'
      ELSE 'ok'
    END;
  ELSE
    v_sla_status := 'sem_prazo';
  END IF;

  v_score := v_score + CASE v_sla_status
    WHEN 'vencido' THEN 50
    WHEN 'critico' THEN 40
    WHEN 'atencao' THEN 20
    ELSE 10
  END;

  -- ── Reincidência ──────────────────────────────────────────────────────────
  IF v_foco.foco_anterior_id IS NOT NULL THEN
    v_score := v_score + 20;
  END IF;

  -- ── Casos notificados próximos (raio 300m, cap 30pts) ────────────────────
  IF v_foco.latitude IS NOT NULL AND v_foco.longitude IS NOT NULL THEN
    SELECT COUNT(*)::integer
    INTO v_casos_count
    FROM public.casos_notificados
    WHERE cliente_id = v_foco.cliente_id
      AND localizacao IS NOT NULL
      AND ST_DWithin(
        localizacao::geography,
        ST_MakePoint(v_foco.longitude, v_foco.latitude)::geography,
        300
      );

    v_score := v_score + LEAST(v_casos_count * 5, 30);
  END IF;

  RETURN v_score;

EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(v_score, 0);
END;
$$;

COMMENT ON FUNCTION public.calcular_score_prioridade_foco(uuid) IS
  'Calcula score de prioridade inteiro para um foco_risco. '
  'SLA inteligente: ok=10, atencao=20, critico=40, vencido=50. '
  'Reincidência (foco_anterior_id IS NOT NULL): +20. '
  'Casos notificados em 300m: +5/caso, máximo +30. '
  'Retorna 0 em caso de erro (EXCEPTION handler).';

-- ── 4. Função trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_recalcular_score_prioridade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('resolvido', 'descartado') THEN
    UPDATE public.focos_risco SET score_prioridade = 0 WHERE id = NEW.id;
  ELSE
    UPDATE public.focos_risco
    SET score_prioridade = public.calcular_score_prioridade_foco(NEW.id)
    WHERE id = NEW.id;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ── 5. Trigger — dispara apenas em mudanças relevantes ───────────────────────
-- UPDATE OF score_prioridade não dispara (evita loop)

DROP TRIGGER IF EXISTS trg_recalcular_score_prioridade ON public.focos_risco;
CREATE TRIGGER trg_recalcular_score_prioridade
  AFTER INSERT OR UPDATE OF status, foco_anterior_id, casos_ids
  ON public.focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_recalcular_score_prioridade();

-- ── 6. Backfill de focos ativos existentes ───────────────────────────────────

UPDATE public.focos_risco
SET score_prioridade = public.calcular_score_prioridade_foco(id)
WHERE status NOT IN ('resolvido', 'descartado')
  AND deleted_at IS NULL;

-- ── 7. Recriar v_focos_risco_ativos (inclui score_prioridade via fr.*) ───────
--
-- Definição idêntica à 20261018011000_sla_inteligente_fase_a_base.sql.
-- fr.* agora inclui score_prioridade — nenhuma outra coluna alterada.

DROP VIEW IF EXISTS public.v_focos_risco_ativos;

CREATE VIEW public.v_focos_risco_ativos
WITH (security_invoker = true)
AS
WITH estado_atual AS (
  SELECT DISTINCT ON (foco_id)
    foco_id             AS foco_risco_id,
    duracao_minutos     AS tempo_em_estado_atual_min
  FROM public.v_tempo_por_estado_foco
  WHERE eh_estado_atual = true
  ORDER BY foco_id, entrou_em DESC
)
SELECT
  fr.*,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.tipo_imovel,
  r.regiao                                                    AS regiao_nome,
  u.nome                                                      AS responsavel_nome,
  sla.prazo_final                                             AS sla_prazo_em,
  sla.violado                                                 AS sla_violado,
  CASE
    WHEN sla.prazo_final IS NULL                                                  THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                  THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10         THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30         THEN 'atencao'
    ELSE 'ok'
  END                                                         AS sla_status,
  COALESCE(li.image_url, fr.payload->>'foto_url')             AS origem_image_url,
  li.item                                                     AS origem_item,
  -- dados mínimos inline
  (
    (   fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    AND (fr.classificacao_inicial IS NOT NULL)
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM public.operacoes o WHERE o.foco_risco_id = fr.id)
    )
  )                                                           AS tem_dados_minimos,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NOT (
      fr.endereco_normalizado IS NOT NULL
      OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
      OR fr.imovel_id IS NOT NULL
    ) THEN 'sem_localizacao' END,
    CASE WHEN NOT (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
      THEN 'sem_bairro' END,
    CASE WHEN NOT (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
      THEN 'sem_descricao' END,
    CASE WHEN NOT (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM public.operacoes o WHERE o.foco_risco_id = fr.id)
    ) THEN 'sem_evidencia' END
  ], NULL)                                                    AS pendencias,

  -- ── SLA Inteligente Fase A ────────────────────────────────────────────────
  CASE fr.status
    WHEN 'suspeita'          THEN 'triagem'
    WHEN 'em_triagem'        THEN 'triagem'
    WHEN 'aguarda_inspecao'  THEN 'triagem'
    WHEN 'em_inspecao'       THEN 'inspecao'
    WHEN 'confirmado'        THEN 'confirmacao'
    WHEN 'em_tratamento'     THEN 'tratamento'
    ELSE 'encerrado'
  END                                                         AS fase_sla,
  ea.tempo_em_estado_atual_min,
  sfc.prazo_minutos                                           AS prazo_fase_min,
  CASE
    WHEN fr.status IN ('resolvido','descartado')
      THEN 'encerrado'
    WHEN sfc.prazo_minutos IS NULL OR ea.tempo_em_estado_atual_min IS NULL
      THEN 'sem_prazo'
    WHEN ea.tempo_em_estado_atual_min > sfc.prazo_minutos
      THEN 'vencido'
    WHEN ea.tempo_em_estado_atual_min >= sfc.prazo_minutos * 0.9
      THEN 'critico'
    WHEN ea.tempo_em_estado_atual_min >= sfc.prazo_minutos * 0.7
      THEN 'atencao'
    ELSE 'ok'
  END                                                         AS status_sla_inteligente

FROM public.focos_risco          fr
LEFT JOIN public.imoveis          i   ON i.id  = fr.imovel_id
LEFT JOIN public.regioes          r   ON r.id  = fr.regiao_id
LEFT JOIN public.usuarios         u   ON u.id  = fr.responsavel_id
LEFT JOIN public.sla_operacional  sla ON sla.foco_risco_id = fr.id
                                     AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN public.levantamento_itens li ON li.id = fr.origem_levantamento_item_id
LEFT JOIN estado_atual            ea  ON ea.foco_risco_id = fr.id
LEFT JOIN public.sla_foco_config  sfc ON sfc.cliente_id   = fr.cliente_id
                                     AND sfc.ativo        = true
                                     AND sfc.fase = CASE fr.status
                                       WHEN 'suspeita'         THEN 'triagem'
                                       WHEN 'em_triagem'       THEN 'triagem'
                                       WHEN 'aguarda_inspecao' THEN 'triagem'
                                       WHEN 'em_inspecao'      THEN 'inspecao'
                                       WHEN 'confirmado'       THEN 'confirmacao'
                                       WHEN 'em_tratamento'    THEN 'tratamento'
                                       ELSE NULL
                                     END
WHERE fr.status     NOT IN ('resolvido','descartado')
  AND fr.deleted_at IS NULL;

GRANT SELECT ON public.v_focos_risco_ativos TO authenticated;

COMMENT ON VIEW public.v_focos_risco_ativos IS
  'Focos em ciclo ativo + dados mínimos + SLA Inteligente + score_prioridade. '
  'score_prioridade incluído via fr.* após 20261019000000_ia_pilot.sql. '
  'Última atualização: 20261019000000_ia_pilot.sql.';

-- ── 8. Recriar v_focos_risco_todos (inclui score_prioridade via fr.*) ─────────
--
-- Definição idêntica à 20260746000000_focos_risco_view_todos.sql.
-- fr.* agora inclui score_prioridade — nenhuma outra coluna alterada.
-- Não inclui colunas SLA Inteligente (view independente de v_focos_risco_ativos).

DROP VIEW IF EXISTS public.v_focos_risco_todos;

CREATE VIEW public.v_focos_risco_todos
WITH (security_invoker = true)
AS
SELECT
  fr.*,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.tipo_imovel,
  r.regiao    AS regiao_nome,
  u.nome      AS responsavel_nome,
  sla.prazo_final AS sla_prazo_em,
  sla.violado     AS sla_violado,
  CASE
    WHEN sla.prazo_final IS NULL                                                  THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                  THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10         THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30         THEN 'atencao'
    ELSE 'ok'
  END AS sla_status,
  li.image_url AS origem_image_url,
  li.item      AS origem_item
FROM public.focos_risco          fr
LEFT JOIN public.imoveis          i   ON i.id  = fr.imovel_id
LEFT JOIN public.regioes          r   ON r.id  = fr.regiao_id
LEFT JOIN public.usuarios         u   ON u.id  = fr.responsavel_id
LEFT JOIN public.sla_operacional  sla ON sla.foco_risco_id = fr.id
                                     AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN public.levantamento_itens li ON li.id = fr.origem_levantamento_item_id
WHERE fr.deleted_at IS NULL;

GRANT SELECT ON public.v_focos_risco_todos TO authenticated;

COMMENT ON VIEW public.v_focos_risco_todos IS
  'Todos os focos (inclui resolvido e descartado). Mesmos JOINs de v_focos_risco_ativos. '
  'score_prioridade incluído via fr.* após 20261019000000_ia_pilot.sql. '
  'Não inclui colunas SLA Inteligente (calculadas apenas em v_focos_risco_ativos). '
  'security_invoker = true — RLS de focos_risco aplicada automaticamente.';

-- ── 9. Verificação ───────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_exists  boolean;
  v_fn_exists   boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'focos_risco'
      AND column_name  = 'score_prioridade'
  ) INTO v_col_exists;

  IF NOT v_col_exists THEN
    RAISE EXCEPTION '[ia_pilot] FALHA: coluna score_prioridade não criada em focos_risco.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'calcular_score_prioridade_foco'
  ) INTO v_fn_exists;

  IF NOT v_fn_exists THEN
    RAISE EXCEPTION '[ia_pilot] FALHA: função calcular_score_prioridade_foco não criada.';
  END IF;

  RAISE NOTICE '[ia_pilot] OK: ia_insights, score_prioridade, função e views criados.';
END;
$$;
