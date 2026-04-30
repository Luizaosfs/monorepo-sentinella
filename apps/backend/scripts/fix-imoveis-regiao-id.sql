-- Script: popular imoveis.regiao_id via PostGIS spatial lookup
-- Pré-requisito: regioes.area deve estar preenchido (cadastrar GeoJSON via UI de Regiões)
-- Executar: psql -h HOST -U USER -d sentinella -f fix-imoveis-regiao-id.sql

-- Passo 1: verificar quantas regiões têm geometria
SELECT COUNT(*) AS regioes_com_area FROM regioes WHERE area IS NOT NULL AND deleted_at IS NULL;

-- Passo 2: preview — quantos imóveis seriam atualizados
SELECT COUNT(*) AS imoveis_a_atualizar
FROM imoveis i
WHERE i.deleted_at IS NULL
  AND i.regiao_id IS NULL
  AND i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM regioes r
    WHERE r.cliente_id = i.cliente_id
      AND r.deleted_at IS NULL
      AND r.area IS NOT NULL
      AND ST_Contains(r.area, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
  );

-- Passo 3: atualizar (descomentar quando confirmar preview)
-- UPDATE imoveis i
-- SET regiao_id = (
--   SELECT r.id
--   FROM regioes r
--   WHERE r.cliente_id = i.cliente_id
--     AND r.deleted_at IS NULL
--     AND r.area IS NOT NULL
--     AND ST_Contains(r.area, ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
--   LIMIT 1
-- )
-- WHERE i.deleted_at IS NULL
--   AND i.regiao_id IS NULL
--   AND i.latitude IS NOT NULL
--   AND i.longitude IS NOT NULL;
