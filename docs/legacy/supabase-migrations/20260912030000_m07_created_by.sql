-- =============================================================================
-- M07: Adicionar created_by em tabelas principais + trigger de auto-preenchimento
--
-- Tabelas: focos_risco, vistorias, casos_notificados
-- O trigger captura auth.uid() no INSERT para rastreabilidade de auditoria.
-- =============================================================================

-- ── 1. Adicionar coluna ───────────────────────────────────────────────────────
ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE public.casos_notificados
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- ── 2. Trigger genérico ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só preenche se ainda nulo (respeita INSERTs que já trazem created_by)
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_set_created_by() IS
  'M07: Preenche created_by com auth.uid() em INSERT, se ainda NULL.';

-- ── 3. Criar triggers ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_focos_risco_created_by ON public.focos_risco;
CREATE TRIGGER trg_focos_risco_created_by
  BEFORE INSERT ON public.focos_risco
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_created_by();

DROP TRIGGER IF EXISTS trg_vistorias_created_by ON public.vistorias;
CREATE TRIGGER trg_vistorias_created_by
  BEFORE INSERT ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_created_by();

DROP TRIGGER IF EXISTS trg_casos_notificados_created_by ON public.casos_notificados;
CREATE TRIGGER trg_casos_notificados_created_by
  BEFORE INSERT ON public.casos_notificados
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_created_by();

-- ── 4. Índice para auditoria (quem criou o quê) ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_focos_risco_created_by
  ON public.focos_risco (created_by) WHERE created_by IS NOT NULL;
