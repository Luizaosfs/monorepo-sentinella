-- ═══════════════════════════════════════════════════════════════════════════════
-- SLA Inteligente — Fase A: Base Analítica
-- 20261018011000_sla_inteligente_fase_a_base.sql
--
-- Objetivo: camada analítica complementar ao sla_operacional existente.
-- Mede tempo por estado do foco_risco usando foco_risco_historico.
-- NÃO altera: sla_operacional, triggers de SLA, frontend, regras do agente.
--
-- Entregas:
--   1. Tabela sla_foco_config — prazos por fase (triagem/inspecao/confirmacao/tratamento)
--   2. Seed para clientes existentes + trigger para novos
--   3. View v_tempo_por_estado_foco — duração por estado via LEAD()
--   4. Índice de suporte em foco_risco_historico
--   5. v_focos_risco_ativos recriada com 4 novas colunas (fase_sla, tempo_em_estado_atual_min,
--      prazo_fase_min, status_sla_inteligente) — mantém todas as colunas anteriores intactas
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela sla_foco_config ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sla_foco_config (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  fase          text        NOT NULL CHECK (fase IN ('triagem','inspecao','confirmacao','tratamento')),
  prazo_minutos integer     NOT NULL CHECK (prazo_minutos > 0),
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sla_foco_config_cliente_fase_unique UNIQUE (cliente_id, fase)
);

ALTER TABLE public.sla_foco_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_foco_config_isolamento" ON public.sla_foco_config
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX IF NOT EXISTS idx_sla_foco_config_cliente
  ON public.sla_foco_config (cliente_id, fase)
  WHERE ativo = true;

COMMENT ON TABLE public.sla_foco_config IS
  'Prazos por fase do foco_risco para SLA Inteligente (Fase A). '
  'Fases: triagem (suspeita→aguarda_inspecao), inspecao (em_inspecao), '
  'confirmacao (confirmado), tratamento (em_tratamento). '
  'NÃO substitui sla_operacional — camada analítica complementar. '
  'Seed automático via trg_seed_sla_foco_config ao criar cliente.';

COMMENT ON COLUMN public.sla_foco_config.prazo_minutos IS
  'Prazo máximo esperado para o foco sair desta fase. '
  'Padrões: triagem=480min, inspecao=720min, confirmacao=1440min, tratamento=2880min.';

-- ── 2. Seed para clientes existentes ─────────────────────────────────────────
-- ON CONFLICT DO NOTHING — não sobrescreve configurações personalizadas.

INSERT INTO public.sla_foco_config (cliente_id, fase, prazo_minutos)
SELECT
  c.id,
  fases.fase,
  fases.prazo_minutos
FROM public.clientes c
CROSS JOIN (VALUES
  ('triagem',      480),
  ('inspecao',     720),
  ('confirmacao', 1440),
  ('tratamento',  2880)
) AS fases(fase, prazo_minutos)
ON CONFLICT (cliente_id, fase) DO NOTHING;

-- ── 3. Trigger: seed automático ao criar novo cliente ────────────────────────

CREATE OR REPLACE FUNCTION public.fn_seed_sla_foco_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sla_foco_config (cliente_id, fase, prazo_minutos)
  VALUES
    (NEW.id, 'triagem',      480),
    (NEW.id, 'inspecao',     720),
    (NEW.id, 'confirmacao', 1440),
    (NEW.id, 'tratamento',  2880)
  ON CONFLICT (cliente_id, fase) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_seed_sla_foco_config IS
  'Cria configuração padrão de SLA por fase ao inserir novo cliente. '
  'Mesmo padrão de trg_seed_score_config.';

DROP TRIGGER IF EXISTS trg_seed_sla_foco_config ON public.clientes;
CREATE TRIGGER trg_seed_sla_foco_config
  AFTER INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_seed_sla_foco_config();

-- ── 4. Trigger updated_at para sla_foco_config ───────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sla_foco_config_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_foco_config_updated_at ON public.sla_foco_config;
CREATE TRIGGER trg_sla_foco_config_updated_at
  BEFORE UPDATE ON public.sla_foco_config
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sla_foco_config_set_updated_at();

-- ── 5. Índice de suporte em foco_risco_historico ─────────────────────────────
-- Necessário para performance do LEAD() por foco + ordenação por tempo.

CREATE INDEX IF NOT EXISTS idx_foco_risco_historico_foco_em
  ON public.foco_risco_historico (foco_risco_id, alterado_em ASC);

-- ── 6. View v_tempo_por_estado_foco ──────────────────────────────────────────
-- Calcula duração de cada estado usando LEAD() sobre foco_risco_historico.
-- Filtra apenas eventos de transição de status (status_novo IS NOT NULL).
-- Quando não há evento posterior (estado corrente), saiu_em = now().
--
-- NOTA: focos criados antes da migration do historico (20260710000000)
-- podem não ter registros — nesses casos o foco não aparece nesta view.
-- Focos sem nenhum event de transicao_status também não aparecem.

CREATE OR REPLACE VIEW public.v_tempo_por_estado_foco
WITH (security_invoker = true)
AS
WITH historico_transicoes AS (
  SELECT
    h.foco_risco_id,
    h.cliente_id,
    h.status_novo                                             AS status,
    h.alterado_em                                             AS entrou_em,
    LEAD(h.alterado_em) OVER (
      PARTITION BY h.foco_risco_id
      ORDER BY h.alterado_em ASC
    )                                                         AS proxima_transicao_em
  FROM public.foco_risco_historico h
  WHERE h.status_novo IS NOT NULL
    AND (
      h.tipo_evento IN ('transicao_status', 'inspecao_iniciada')
      OR h.tipo_evento IS NULL   -- registros legados anteriores ao campo tipo_evento
    )
)
SELECT
  foco_risco_id                                               AS foco_id,
  cliente_id,
  status,
  entrou_em,
  COALESCE(proxima_transicao_em, now())                       AS saiu_em,
  GREATEST(
    0,
    EXTRACT(EPOCH FROM
      (COALESCE(proxima_transicao_em, now()) - entrou_em)
    ) / 60
  )::integer                                                  AS duracao_minutos,
  (proxima_transicao_em IS NULL)                              AS eh_estado_atual
FROM historico_transicoes;

GRANT SELECT ON public.v_tempo_por_estado_foco TO authenticated;

COMMENT ON VIEW public.v_tempo_por_estado_foco IS
  'Duração de cada estado por foco, derivada de foco_risco_historico via LEAD(). '
  'eh_estado_atual=true quando saiu_em é now() (foco ainda neste estado). '
  'Filtro: status_novo IS NOT NULL AND (tipo_evento transicao/inspecao OR NULL legado). '
  'SLA Inteligente Fase A — não substitui sla_operacional. '
  'Migration: 20261018011000_sla_inteligente_fase_a_base.sql.';

-- ── 7. Recriar v_focos_risco_ativos com colunas SLA Inteligente ──────────────
--
-- Base: 20261003020000_fix_focos_ativos_image_url_v2.sql
-- Todas as colunas anteriores preservadas integralmente.
-- Novas colunas adicionadas no final (não quebra queries com SELECT *):
--   fase_sla, tempo_em_estado_atual_min, prazo_fase_min, status_sla_inteligente
--
-- Mapeamento status → fase_sla:
--   suspeita, em_triagem, aguarda_inspecao → triagem
--   em_inspecao                            → inspecao
--   confirmado                             → confirmacao
--   em_tratamento                          → tratamento
--   resolvido, descartado                  → encerrado (view só tem ativos, mas por segurança)
--
-- status_sla_inteligente:
--   encerrado  → foco terminal (não deveria aparecer nesta view)
--   sem_prazo  → fase sem configuração em sla_foco_config
--   vencido    → tempo > prazo
--   critico    → tempo >= 90% do prazo
--   atencao    → tempo >= 70% do prazo
--   ok         → abaixo de 70%

DROP VIEW IF EXISTS public.v_focos_risco_ativos CASCADE;

CREATE VIEW public.v_focos_risco_ativos
WITH (security_invoker = true)
AS
-- CTE: estado atual de cada foco ativo (última linha eh_estado_atual=true)
WITH estado_atual AS (
  SELECT DISTINCT ON (foco_id)
    foco_id                  AS foco_risco_id,
    duracao_minutos          AS tempo_em_estado_atual_min
  FROM public.v_tempo_por_estado_foco
  WHERE eh_estado_atual = true
  ORDER BY foco_id, entrou_em DESC
)
SELECT
  -- ── colunas originais (20261003020000) ────────────────────────────────────
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
    WHEN sla.prazo_final IS NULL
      THEN 'sem_sla'
    WHEN sla.prazo_final < now()
      THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10
      THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30
      THEN 'atencao'
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

  -- ── colunas novas: SLA Inteligente Fase A ────────────────────────────────
  CASE fr.status
    WHEN 'suspeita'          THEN 'triagem'
    WHEN 'em_triagem'        THEN 'triagem'
    WHEN 'aguarda_inspecao'  THEN 'triagem'
    WHEN 'em_inspecao'       THEN 'inspecao'
    WHEN 'confirmado'        THEN 'confirmacao'
    WHEN 'em_tratamento'     THEN 'tratamento'
    ELSE                          'encerrado'
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
  'Focos em ciclo ativo + dados mínimos + SLA Inteligente Fase A. '
  'Colunas preservadas: todas as de 20261003020000 (sem quebra de API). '
  'Novas colunas (Fase A): fase_sla, tempo_em_estado_atual_min, prazo_fase_min, status_sla_inteligente. '
  'origem_image_url = COALESCE(levantamento_itens.image_url, payload.foto_url). '
  'security_invoker = true — RLS de focos_risco aplicada automaticamente. '
  'Última atualização: 20261018011000_sla_inteligente_fase_a_base.sql.';

-- ── 8. Restaurar grant em v_focos_risco_todos (CASCADE pode ter dropado) ─────
-- v_focos_risco_todos não depende de v_focos_risco_ativos, mas por segurança:
GRANT SELECT ON public.v_focos_risco_todos TO authenticated;

-- ── 9. Verificação interna ────────────────────────────────────────────────────
-- Valida que a tabela e a view foram criadas corretamente.
-- Executa silenciosamente — erro aqui reverte a migration inteira.

DO $$
DECLARE
  v_config_count  bigint;
  v_view_exists   boolean;
  v_col_exists    boolean;
BEGIN
  -- sla_foco_config foi populada?
  SELECT COUNT(*) INTO v_config_count FROM public.sla_foco_config;
  IF v_config_count = 0 THEN
    RAISE WARNING '[sla_inteligente_fase_a] sla_foco_config está vazia — sem clientes cadastrados ou seed falhou.';
  ELSE
    RAISE NOTICE '[sla_inteligente_fase_a] sla_foco_config: % linhas inseridas/existentes.', v_config_count;
  END IF;

  -- v_tempo_por_estado_foco existe?
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'v_tempo_por_estado_foco'
  ) INTO v_view_exists;
  IF NOT v_view_exists THEN
    RAISE EXCEPTION '[sla_inteligente_fase_a] FALHA: v_tempo_por_estado_foco não criada.';
  END IF;

  -- v_focos_risco_ativos tem coluna status_sla_inteligente?
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'v_focos_risco_ativos'
      AND column_name  = 'status_sla_inteligente'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION '[sla_inteligente_fase_a] FALHA: coluna status_sla_inteligente ausente em v_focos_risco_ativos.';
  END IF;

  RAISE NOTICE '[sla_inteligente_fase_a] Verificação concluída com sucesso.';
END;
$$;
