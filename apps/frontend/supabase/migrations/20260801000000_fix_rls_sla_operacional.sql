-- =============================================================================
-- 2A: Corrigir RLS de sla_operacional — focos SLAs ficam invisíveis
--
-- Problema: linhas de sla_operacional geradas por triggers de focos_risco
-- podem ter cliente_id = NULL se o trigger não o propagou corretamente.
-- usuario_pode_acessar_cliente(NULL) → false → SLAs de focos invisíveis no painel.
--
-- Fix:
--   1. Backfill: popular cliente_id nulo usando foco_risco_id e levantamento_item_id.
--   2. RLS select robusto: USING(cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id))
--      + fallback via foco_risco_id/levantamento_item_id para linhas ainda nulas.
--   3. Trigger: garantir que novas linhas sempre carregam cliente_id.
-- =============================================================================

-- ── 1. Backfill via foco_risco_id ─────────────────────────────────────────────
UPDATE sla_operacional sla
SET cliente_id = fr.cliente_id
FROM focos_risco fr
WHERE sla.foco_risco_id = fr.id
  AND sla.cliente_id IS NULL
  AND fr.cliente_id IS NOT NULL;

-- ── 2. Backfill via levantamento_item_id → levantamentos ──────────────────────
UPDATE sla_operacional sla
SET cliente_id = l.cliente_id
FROM levantamento_itens li
JOIN levantamentos l ON l.id = li.levantamento_id
WHERE sla.levantamento_item_id = li.id
  AND sla.cliente_id IS NULL
  AND l.cliente_id IS NOT NULL;

-- ── 3. Recriar políticas RLS com fallback para linhas órfãs ───────────────────

DROP POLICY IF EXISTS "sla_operacional_select" ON public.sla_operacional;
CREATE POLICY "sla_operacional_select" ON public.sla_operacional
  FOR SELECT TO authenticated
  USING (
    -- Caminho principal: cliente_id preenchido
    (cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id))
    OR
    -- Fallback: linha órfã com foco_risco linkado ao cliente do usuário
    (cliente_id IS NULL AND foco_risco_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM focos_risco fr
      WHERE fr.id = foco_risco_id AND usuario_pode_acessar_cliente(fr.cliente_id)
    ))
    OR
    -- Fallback: linha órfã com levantamento_item linkado ao cliente do usuário
    (cliente_id IS NULL AND levantamento_item_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM levantamento_itens li
      JOIN levantamentos l ON l.id = li.levantamento_id
      WHERE li.id = levantamento_item_id AND usuario_pode_acessar_cliente(l.cliente_id)
    ))
  );

DROP POLICY IF EXISTS "sla_operacional_insert" ON public.sla_operacional;
CREATE POLICY "sla_operacional_insert" ON public.sla_operacional
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id)
  );

DROP POLICY IF EXISTS "sla_operacional_update" ON public.sla_operacional;
CREATE POLICY "sla_operacional_update" ON public.sla_operacional
  FOR UPDATE TO authenticated
  USING  (cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "sla_operacional_delete" ON public.sla_operacional;
CREATE POLICY "sla_operacional_delete" ON public.sla_operacional
  FOR DELETE TO authenticated
  USING (cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id));

-- ── 4. Trigger para garantir cliente_id em novos registros ────────────────────
CREATE OR REPLACE FUNCTION fn_sla_operacional_set_cliente_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve via foco_risco_id
  IF NEW.foco_risco_id IS NOT NULL THEN
    SELECT cliente_id INTO NEW.cliente_id
    FROM focos_risco WHERE id = NEW.foco_risco_id;
  END IF;

  -- Resolve via levantamento_item_id se ainda NULL
  IF NEW.cliente_id IS NULL AND NEW.levantamento_item_id IS NOT NULL THEN
    SELECT l.cliente_id INTO NEW.cliente_id
    FROM levantamento_itens li
    JOIN levantamentos l ON l.id = li.levantamento_id
    WHERE li.id = NEW.levantamento_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_set_cliente_id ON sla_operacional;
CREATE TRIGGER trg_sla_set_cliente_id
  BEFORE INSERT ON sla_operacional
  FOR EACH ROW EXECUTE FUNCTION fn_sla_operacional_set_cliente_id();
