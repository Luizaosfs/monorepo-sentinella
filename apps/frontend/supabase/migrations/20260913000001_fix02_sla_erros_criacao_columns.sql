-- =============================================================================
-- FIX-02: Adicionar colunas faltantes em sla_erros_criacao
--
-- Problema: A migration S05 (20260910030000) reescreveu os triggers de SLA para
-- inserir nas colunas (item_id, contexto, created_at) em sla_erros_criacao,
-- mas essas colunas nunca foram adicionadas à tabela.
-- Resultado: quando o trigger tenta logar um erro, o INSERT falha silenciosamente
-- (cai em EXCEPTION → RAISE WARNING) e o erro se perde.
--
-- Tabela original (20260714): id, levantamento_item_id, erro, criado_em
-- Adicionado em 20260758:      + cliente_id
-- Adicionado em 20260722:      + retention_until (QW-10C)
-- Faltam:                      item_id, contexto, created_at
-- =============================================================================

-- item_id: referência ao pluvio_operacional_item (trigger trg_pluvio_item_criar_sla_auto)
ALTER TABLE public.sla_erros_criacao
  ADD COLUMN IF NOT EXISTS item_id uuid;

-- contexto: payload JSONB com detalhes do erro (prioridade, sla_horas, etc.)
ALTER TABLE public.sla_erros_criacao
  ADD COLUMN IF NOT EXISTS contexto jsonb;

-- created_at: alias padronizado para criado_em (S05 usa created_at nos INSERTs)
ALTER TABLE public.sla_erros_criacao
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill: created_at ← criado_em para registros existentes
UPDATE public.sla_erros_criacao
SET created_at = criado_em
WHERE created_at = now()  -- apenas registros sem valor real (default acabou de ser aplicado)
  AND criado_em IS NOT NULL
  AND criado_em <> now();

-- Índice para consulta por item_id (pluvio)
CREATE INDEX IF NOT EXISTS idx_sla_erros_criacao_item_id
  ON public.sla_erros_criacao (item_id)
  WHERE item_id IS NOT NULL;

COMMENT ON COLUMN public.sla_erros_criacao.item_id IS
  'FIX-02: ID do pluvio_operacional_item quando o erro vem do trigger de SLA pluviométrico.';
COMMENT ON COLUMN public.sla_erros_criacao.contexto IS
  'FIX-02: Payload JSONB com detalhes do erro (prioridade, sla_horas, inicio, prazo_final, status).';
COMMENT ON COLUMN public.sla_erros_criacao.created_at IS
  'FIX-02: Alias padronizado de criado_em; usado pelos triggers S05 nos INSERTs.';
COMMENT ON TABLE public.sla_erros_criacao IS
  'Registra falhas na criação automática de SLA. '
  'Populado pelos triggers trg_pluvio_item_criar_sla_auto (item_id) e '
  'trg_levantamento_item_criar_sla_auto (levantamento_item_id). '
  'Colunas: cliente_id, item_id, levantamento_item_id, erro, contexto, created_at, criado_em.';
