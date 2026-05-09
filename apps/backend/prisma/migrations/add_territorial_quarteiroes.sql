-- Adiciona suporte territorial a quarteiroes
-- Segue o mesmo padrão de regioes: geojson (jsonb) + area (PostGIS) + latitude + longitude
-- Todos os campos são nullable — não quebra registros existentes.

ALTER TABLE quarteiroes
  ADD COLUMN IF NOT EXISTS geojson   jsonb,
  ADD COLUMN IF NOT EXISTS area      geometry(Polygon, 4326),
  ADD COLUMN IF NOT EXISTS latitude  float8,
  ADD COLUMN IF NOT EXISTS longitude float8;

-- Índice GIST para queries ST_Contains futuras (ex: encontrar quarteirão por coordenada)
CREATE INDEX IF NOT EXISTS idx_quarteiroes_area
  ON quarteiroes USING GIST (area)
  WHERE area IS NOT NULL;
