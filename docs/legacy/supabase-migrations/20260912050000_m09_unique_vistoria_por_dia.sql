-- =============================================================================
-- M09: Índice único em vistorias para evitar duplicatas no mesmo dia
--
-- Regra: um agente não pode registrar duas vistorias com acesso confirmado
-- no mesmo imóvel no mesmo ciclo no mesmo dia (acesso_realizado = true).
-- Visitas sem acesso (revisita) são permitidas múltiplas vezes.
-- =============================================================================

-- CAST(timestamptz AS date) não é IMMUTABLE (depende do timezone da sessão).
-- Wrapper IMMUTABLE permite usar a expressão em índice.
CREATE OR REPLACE FUNCTION public.fn_tstz_to_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$ SELECT $1::date; $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vistorias_imovel_ciclo_dia_unico
  ON public.vistorias (imovel_id, ciclo, public.fn_tstz_to_date(data_visita))
  WHERE acesso_realizado = true
    AND deleted_at IS NULL;

COMMENT ON INDEX public.idx_vistorias_imovel_ciclo_dia_unico IS
  'M09: Impede duplicata de vistoria com acesso confirmado para o mesmo imóvel/ciclo/dia.';
