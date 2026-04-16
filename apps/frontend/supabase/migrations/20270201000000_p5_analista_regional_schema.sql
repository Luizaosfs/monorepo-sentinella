-- =============================================================================
-- P5: Analista Regional — Estrutura base
--
-- Ordem crítica:
--   1. Enum
--   2. agrupamento_regional (sem policies que referenciam usuarios ainda)
--   3. agrupamento_cliente
--   4. ADD COLUMN agrupamento_id em usuarios  ← deve vir ANTES das policies
--   5. Constraint
--   6. Policies que referenciam usuarios.agrupamento_id
-- =============================================================================

-- 1. Estender o enum
ALTER TYPE public.papel_app ADD VALUE IF NOT EXISTS 'analista_regional';

-- =============================================================================
-- 2. Tabela agrupamento_regional (só policy de admin por ora)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agrupamento_regional (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text    NOT NULL,
  tipo       text    NOT NULL CHECK (tipo IN ('consorcio', 'regiao_saude', 'estado')),
  uf         char(2),
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agrupamento_regional_ativo ON public.agrupamento_regional (ativo);

ALTER TABLE public.agrupamento_regional ENABLE ROW LEVEL SECURITY;

-- Somente admin cria/edita agrupamentos
CREATE POLICY "admin_gerencia_agrupamentos" ON public.agrupamento_regional
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 3. Tabela agrupamento_cliente (só policy de admin por ora)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agrupamento_cliente (
  agrupamento_id uuid NOT NULL REFERENCES public.agrupamento_regional(id) ON DELETE CASCADE,
  cliente_id     uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  adicionado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agrupamento_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_agrupamento_cliente_cliente ON public.agrupamento_cliente (cliente_id);

ALTER TABLE public.agrupamento_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gerencia_agrupamento_cliente" ON public.agrupamento_cliente
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 4. Adicionar agrupamento_id a usuarios (ANTES das policies que a referenciam)
-- =============================================================================

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS agrupamento_id uuid
  REFERENCES public.agrupamento_regional(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_agrupamento ON public.usuarios (agrupamento_id)
  WHERE agrupamento_id IS NOT NULL;

-- =============================================================================
-- 5. Constraint: cliente_id e agrupamento_id são mutuamente exclusivos
-- =============================================================================

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS chk_usuarios_cliente_agrupamento_exclusivo;

ALTER TABLE public.usuarios
  ADD CONSTRAINT chk_usuarios_cliente_agrupamento_exclusivo
  CHECK (NOT (cliente_id IS NOT NULL AND agrupamento_id IS NOT NULL));

-- =============================================================================
-- 6. Policies que referenciam usuarios.agrupamento_id (agora a coluna existe)
-- =============================================================================

-- analista_regional lê o próprio agrupamento
CREATE POLICY "analista_le_proprio_agrupamento" ON public.agrupamento_regional
  FOR SELECT
  USING (
    id = (
      SELECT agrupamento_id FROM public.usuarios
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );

-- analista_regional lê os vínculos do próprio agrupamento
CREATE POLICY "analista_le_proprios_vinculos" ON public.agrupamento_cliente
  FOR SELECT
  USING (
    agrupamento_id = (
      SELECT agrupamento_id FROM public.usuarios
      WHERE auth_id = auth.uid()
      LIMIT 1
    )
  );

-- =============================================================================
-- Comentários
-- =============================================================================

COMMENT ON COLUMN public.usuarios.agrupamento_id IS
  'Preenchido apenas para papel=analista_regional. '
  'Mutuamente exclusivo com cliente_id (CHECK constraint).';

COMMENT ON TABLE public.agrupamento_regional IS
  'Consórcio, região de saúde ou estado que agrupa múltiplos municípios/clientes '
  'para visualização analítica cross-tenant pelo papel analista_regional.';

COMMENT ON TABLE public.agrupamento_cliente IS
  'Vínculo N:N entre agrupamento_regional e clientes (municípios).';
