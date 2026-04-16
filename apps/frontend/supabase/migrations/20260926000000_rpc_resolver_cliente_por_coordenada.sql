-- RPC pública: resolve qual cliente (município) corresponde a uma coordenada GPS.
-- Estratégia 1: ST_Contains com o polígono `area` (GeoJSON) — match exato.
-- Estratégia 2: Fallback por centroide mais próximo (≤ 30 km) quando `area` é null.
-- Sem autenticação necessária (SECURITY DEFINER, acessível pelo canal cidadão).

CREATE OR REPLACE FUNCTION public.resolver_cliente_por_coordenada(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE (
  cliente_id    uuid,
  cliente_nome  text,
  cidade        text,
  uf            text,
  encontrado    boolean,
  metodo        text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM (
    -- 1ª tentativa: ponto dentro do polígono GeoJSON (match exato)
    (
      SELECT
        id             AS cliente_id,
        nome           AS cliente_nome,
        cidade,
        uf,
        true           AS encontrado,
        'poligono'     AS metodo
      FROM clientes
      WHERE ativo = true
        AND deleted_at IS NULL
        AND area IS NOT NULL
        AND ST_Contains(
          ST_SetSRID(ST_GeomFromGeoJSON(area::text), 4326),
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
        )
      LIMIT 1
    )

    UNION ALL

    -- 2ª tentativa: centroide mais próximo (≤ 30 km)
    (
      SELECT
        id             AS cliente_id,
        nome           AS cliente_nome,
        cidade,
        uf,
        true           AS encontrado,
        'centroide'    AS metodo
      FROM clientes
      WHERE ativo = true
        AND deleted_at IS NULL
        AND latitude_centro IS NOT NULL
        AND longitude_centro IS NOT NULL
        AND ST_Distance(
          ST_MakePoint(longitude_centro, latitude_centro)::geography,
          ST_MakePoint(p_lng, p_lat)::geography
        ) <= 30000
      ORDER BY
        ST_MakePoint(longitude_centro, latitude_centro)::geography
        <-> ST_MakePoint(p_lng, p_lat)::geography
      LIMIT 1
    )
  ) sub
  LIMIT 1;
$$;

-- Permissão para anon (canal cidadão não tem autenticação)
GRANT EXECUTE ON FUNCTION public.resolver_cliente_por_coordenada(double precision, double precision)
  TO anon, authenticated;
