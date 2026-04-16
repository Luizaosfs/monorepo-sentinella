-- Agrega consumo de larvicida por ciclo, agente e tipo de depósito.
CREATE OR REPLACE FUNCTION public.rpc_consumo_larvicida(
  p_cliente_id uuid,
  p_ciclo      integer
)
RETURNS TABLE (
  agente_id          uuid,
  agente_nome        text,
  total_larvicida_g  numeric,
  total_vistorias    int,
  depositos_tratados int,
  por_tipo           jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Pré-agregar por (agente, tipo) para evitar agregações aninhadas
  WITH base AS (
    SELECT
      v.agente_id,
      u.nome           AS agente_nome,
      v.id             AS vistoria_id,
      d.id             AS deposito_id,
      d.tipo,
      d.qtd_larvicida_g,
      d.usou_larvicida
    FROM vistorias v
    JOIN usuarios u ON u.id = v.agente_id
    JOIN vistoria_depositos d ON d.vistoria_id = v.id
    WHERE v.cliente_id = p_cliente_id
      AND v.ciclo = p_ciclo
      AND v.acesso_realizado = true
  ),
  tipo_agg AS (
    SELECT
      agente_id,
      tipo,
      COALESCE(SUM(qtd_larvicida_g) FILTER (WHERE usou_larvicida), 0) AS g_tipo
    FROM base
    WHERE tipo IS NOT NULL
    GROUP BY agente_id, tipo
  ),
  tipo_json AS (
    SELECT
      agente_id,
      jsonb_object_agg(tipo, g_tipo) AS por_tipo
    FROM tipo_agg
    GROUP BY agente_id
  )
  SELECT
    b.agente_id,
    MAX(b.agente_nome)::text                                      AS agente_nome,
    COALESCE(SUM(b.qtd_larvicida_g), 0)                          AS total_larvicida_g,
    COUNT(DISTINCT b.vistoria_id)::int                            AS total_vistorias,
    COUNT(b.deposito_id) FILTER (WHERE b.usou_larvicida)::int     AS depositos_tratados,
    COALESCE(tj.por_tipo, '{}'::jsonb)                            AS por_tipo
  FROM base b
  LEFT JOIN tipo_json tj ON tj.agente_id = b.agente_id
  GROUP BY b.agente_id, tj.por_tipo
  ORDER BY total_larvicida_g DESC;
$$;
