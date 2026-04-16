-- Evolução do import_log: adicionar colunas de geocodificação e deduplicação.
-- Backward-compatible: todas as colunas são DEFAULT 0 / NOT NULL.

ALTER TABLE public.import_log
  ADD COLUMN IF NOT EXISTS duplicados    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geocodificados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geo_falhou    integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.import_log.duplicados     IS 'Imóveis ignorados por já existirem no banco (cliente_id + logradouro + numero + bairro).';
COMMENT ON COLUMN public.import_log.geocodificados IS 'Imóveis que não tinham coordenadas e foram geocodificados com sucesso via Nominatim.';
COMMENT ON COLUMN public.import_log.geo_falhou     IS 'Imóveis sem coordenadas para os quais a geocodificação falhou — importados sem lat/lng.';
