-- =============================================================================
-- A01: Denormalizar cliente_id em levantamento_itens
--
-- Problema: RLS depende de JOIN com levantamentos (lento e frágil).
-- Fix: adicionar cliente_id direto + trigger de auto-preenchimento + RLS direto.
-- =============================================================================

-- ── 0. Remover triggers quebrados antes do backfill ──────────────────────────
-- Todos referenciam OLD.status_atendimento (coluna removida em 20260711).
-- Qualquer UPDATE na tabela falha enquanto existirem.
-- A06 (20260911020000) também dropa trg_levantamento_item_status_historico; idempotente com IF EXISTS.
DROP TRIGGER IF EXISTS trg_levantamento_item_status_historico     ON public.levantamento_itens;
-- trg_validar_transicao_status_atendimento: criado em 20260604, nunca dropado em 20260711
DROP TRIGGER IF EXISTS trg_validar_transicao_status_atendimento   ON public.levantamento_itens;

-- ── 1. Adicionar colunas ─────────────────────────────────────────────────────
ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id);

-- updated_at deve existir ANTES do backfill: há um trigger BEFORE UPDATE
-- (fn_set_updated_at) que acessa NEW.updated_at — sem a coluna o UPDATE falha.
ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
UPDATE public.levantamento_itens li
SET cliente_id = l.cliente_id
FROM public.levantamentos l
WHERE l.id = li.levantamento_id
  AND li.cliente_id IS NULL;

-- ── 3. Índice de performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_levantamento_itens_cliente_id
  ON public.levantamento_itens (cliente_id);

-- ── 4. Trigger — auto-preenche em INSERTs futuros ────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_levantamento_itens_set_cliente_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NULL THEN
    SELECT l.cliente_id INTO NEW.cliente_id
    FROM public.levantamentos l
    WHERE l.id = NEW.levantamento_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_levantamento_itens_set_cliente_id ON public.levantamento_itens;
CREATE TRIGGER trg_levantamento_itens_set_cliente_id
  BEFORE INSERT ON public.levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_levantamento_itens_set_cliente_id();

-- ── 5. Reescrever RLS para usar cliente_id direto (sem JOIN) ─────────────────
DROP POLICY IF EXISTS "levantamento_itens_select" ON public.levantamento_itens;
DROP POLICY IF EXISTS "levantamento_itens_insert" ON public.levantamento_itens;
DROP POLICY IF EXISTS "levantamento_itens_update" ON public.levantamento_itens;
DROP POLICY IF EXISTS "levantamento_itens_delete" ON public.levantamento_itens;
-- Políticas com outros nomes possíveis
DROP POLICY IF EXISTS "isolamento_por_cliente" ON public.levantamento_itens;
DROP POLICY IF EXISTS "levantamento_itens_isolamento" ON public.levantamento_itens;

CREATE POLICY "levantamento_itens_select" ON public.levantamento_itens
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_itens_insert" ON public.levantamento_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_itens_update" ON public.levantamento_itens
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_itens_delete" ON public.levantamento_itens
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

COMMENT ON COLUMN public.levantamento_itens.cliente_id IS
  'A01: Denormalizado de levantamentos.cliente_id para RLS direto e performance.';
