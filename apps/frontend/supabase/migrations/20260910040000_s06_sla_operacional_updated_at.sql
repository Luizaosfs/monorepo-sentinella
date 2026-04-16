-- =============================================================================
-- S06: Adicionar updated_at em sla_operacional
--
-- Tabela crítica sem updated_at — impossível auditar quando o último UPDATE ocorreu.
-- =============================================================================

ALTER TABLE public.sla_operacional
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.trg_sla_operacional_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_operacional_updated_at ON public.sla_operacional;
CREATE TRIGGER trg_sla_operacional_updated_at
  BEFORE UPDATE ON public.sla_operacional
  FOR EACH ROW EXECUTE FUNCTION public.trg_sla_operacional_updated_at();

-- Backfill: usar a data mais recente disponível como proxy
UPDATE public.sla_operacional
SET updated_at = COALESCE(escalonado_em, concluido_em, created_at)
WHERE updated_at = now();
