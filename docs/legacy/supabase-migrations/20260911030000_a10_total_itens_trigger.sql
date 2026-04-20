-- =============================================================================
-- A10: Trigger bidirecional para total_itens em levantamentos
--
-- Problema: total_itens não é atualizado em DELETE ou soft delete.
-- Fix: trigger AFTER INSERT/UPDATE/DELETE que recalcula o total.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_sync_total_itens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lev_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_lev_id := NEW.levantamento_id;

  ELSIF TG_OP = 'DELETE' THEN
    v_lev_id := OLD.levantamento_id;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.levantamento_id IS DISTINCT FROM NEW.levantamento_id THEN
      -- Mudou de levantamento: atualizar o antigo
      UPDATE public.levantamentos
      SET total_itens = (
        SELECT COUNT(*) FROM public.levantamento_itens
        WHERE levantamento_id = OLD.levantamento_id
          AND deleted_at IS NULL
      )
      WHERE id = OLD.levantamento_id;
      v_lev_id := NEW.levantamento_id;
    ELSIF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
      -- Soft delete/restore
      v_lev_id := NEW.levantamento_id;
    ELSE
      -- Nenhuma mudança relevante para total_itens
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  UPDATE public.levantamentos
  SET total_itens = (
    SELECT COUNT(*) FROM public.levantamento_itens
    WHERE levantamento_id = v_lev_id
      AND deleted_at IS NULL
  )
  WHERE id = v_lev_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_total_itens ON public.levantamento_itens;
CREATE TRIGGER trg_sync_total_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_total_itens();

COMMENT ON FUNCTION public.trg_sync_total_itens() IS
  'A10: Mantém levantamentos.total_itens sincronizado em INSERT/UPDATE/DELETE/soft-delete.';
