-- =============================================================================
-- B02: tags.cliente_id opcional — suporte a tags globais (NULL = plataforma)
--
-- Tags com cliente_id = NULL são visíveis para todos os clientes autenticados.
-- Tags com cliente_id definido são visíveis apenas ao respectivo cliente.
-- =============================================================================

-- ── 1. Adicionar coluna (se tabela existir) ───────────────────────────────────
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

-- ── 2. Índice para busca por cliente (inclui globais) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_tags_cliente_id
  ON public.tags (cliente_id);

-- ── 3. Reescrever RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolamento_por_cliente" ON public.tags;
DROP POLICY IF EXISTS "tags_select"            ON public.tags;
DROP POLICY IF EXISTS "tags_insert"            ON public.tags;
DROP POLICY IF EXISTS "tags_update"            ON public.tags;
DROP POLICY IF EXISTS "tags_delete"            ON public.tags;

-- SELECT: tags globais (NULL) + tags do próprio cliente
CREATE POLICY "tags_select" ON public.tags
  FOR SELECT TO authenticated
  USING (
    cliente_id IS NULL
    OR public.usuario_pode_acessar_cliente(cliente_id)
  );

-- INSERT: só pode criar tags para seu próprio cliente (ou NULL se admin)
CREATE POLICY "tags_insert" ON public.tags
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id IS NULL
    OR public.usuario_pode_acessar_cliente(cliente_id)
  );

-- UPDATE: apenas tags do próprio cliente; globais são somente-leitura
CREATE POLICY "tags_update" ON public.tags
  FOR UPDATE TO authenticated
  USING (
    cliente_id IS NOT NULL
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    cliente_id IS NOT NULL
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- DELETE: apenas tags do próprio cliente
CREATE POLICY "tags_delete" ON public.tags
  FOR DELETE TO authenticated
  USING (
    cliente_id IS NOT NULL
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

COMMENT ON COLUMN public.tags.cliente_id IS
  'B02: NULL = tag global (visível a todos); definido = tag exclusiva do cliente.';
