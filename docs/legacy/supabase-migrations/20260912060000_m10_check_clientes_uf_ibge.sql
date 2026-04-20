-- =============================================================================
-- M10: CHECK constraints em clientes.uf e clientes.ibge_municipio
--
-- uf:            exatamente 2 caracteres maiúsculos (ex: SP, RJ, MS)
-- ibge_municipio: exatamente 7 dígitos numéricos (código IBGE padrão)
--
-- Backfill: normaliza valores existentes antes de aplicar as constraints.
-- =============================================================================

-- ── Backfill: normalizar uf existente ────────────────────────────────────────
UPDATE public.clientes
SET uf = UPPER(TRIM(uf))
WHERE uf IS NOT NULL
  AND UPPER(TRIM(uf)) ~ '^[A-Z]{2}$';

-- Zerar valores que não têm 2 chars (não vão satisfazer o CHECK)
UPDATE public.clientes
SET uf = NULL
WHERE uf IS NOT NULL
  AND UPPER(TRIM(uf)) !~ '^[A-Z]{2}$';

-- ── Backfill: normalizar ibge_municipio existente ────────────────────────────
UPDATE public.clientes
SET ibge_municipio = TRIM(ibge_municipio)
WHERE ibge_municipio IS NOT NULL
  AND TRIM(ibge_municipio) ~ '^[0-9]{7}$';

UPDATE public.clientes
SET ibge_municipio = NULL
WHERE ibge_municipio IS NOT NULL
  AND TRIM(ibge_municipio) !~ '^[0-9]{7}$';

-- ── Aplicar CHECK constraints ─────────────────────────────────────────────────
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS chk_clientes_uf;

ALTER TABLE public.clientes
  ADD CONSTRAINT chk_clientes_uf
  CHECK (uf IS NULL OR (LENGTH(uf) = 2 AND uf = UPPER(uf)));

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS chk_clientes_ibge_municipio;

ALTER TABLE public.clientes
  ADD CONSTRAINT chk_clientes_ibge_municipio
  CHECK (ibge_municipio IS NULL OR ibge_municipio ~ '^[0-9]{7}$');

COMMENT ON CONSTRAINT chk_clientes_uf ON public.clientes IS
  'M10: UF deve ter exatamente 2 letras maiúsculas (ex: SP, RJ).';

COMMENT ON CONSTRAINT chk_clientes_ibge_municipio ON public.clientes IS
  'M10: ibge_municipio deve ter exatamente 7 dígitos numéricos.';
