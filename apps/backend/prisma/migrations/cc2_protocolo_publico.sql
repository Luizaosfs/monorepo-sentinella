-- CC-2: protocolo_publico em focos_risco
-- Coluna pública derivada para consulta pelo cidadão. Formato: SENT-YYYY-XXXXXX
-- Substitui o prefixo UUID de 8 hex chars, removendo enumerabilidade e PII (observacao).

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS protocolo_publico TEXT;

-- Unique constraint nula (NULL não é considerado duplicata no Postgres)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_focos_risco_protocolo_publico
  ON public.focos_risco (protocolo_publico);

-- Backfill para focos existentes com origem_tipo = 'cidadao'
UPDATE public.focos_risco
SET protocolo_publico =
  'SENT-' || EXTRACT(YEAR FROM created_at)::text || '-' ||
  UPPER(SUBSTRING(MD5(id::text), 1, 6))
WHERE origem_tipo = 'cidadao'
  AND protocolo_publico IS NULL;
