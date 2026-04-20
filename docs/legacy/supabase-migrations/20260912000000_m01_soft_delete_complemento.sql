-- =============================================================================
-- M01: Completar soft delete em tabelas que faltam deleted_at/deleted_by
-- =============================================================================

ALTER TABLE public.operacoes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.quarteiroes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.regioes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.planejamento
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.levantamentos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.unidades_saude
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Índices parciais para queries eficientes (apenas registros ativos)
CREATE INDEX IF NOT EXISTS idx_operacoes_ativo
  ON public.operacoes (cliente_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quarteiroes_ativo
  ON public.quarteiroes (cliente_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_regioes_ativo
  ON public.regioes (cliente_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_planejamento_ativo
  ON public.planejamento (cliente_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_levantamentos_ativo
  ON public.levantamentos (cliente_id) WHERE deleted_at IS NULL;
