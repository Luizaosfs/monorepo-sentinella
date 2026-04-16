-- Agrega métricas de todos os agentes de um cliente em um ciclo.
CREATE OR REPLACE FUNCTION public.rpc_comparativo_agentes(
  p_cliente_id uuid,
  p_ciclo      integer
)
RETURNS TABLE (
  agente_id           uuid,
  agente_nome         text,
  total_visitas       int,
  com_acesso          int,
  sem_acesso          int,
  imoveis_com_foco    int,
  larvicida_aplicado  int,
  taxa_acesso         numeric,
  media_depositos_dia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.agente_id,
    u.nome                                                            AS agente_nome,
    COUNT(v.id)::int                                                  AS total_visitas,
    COUNT(v.id) FILTER (WHERE v.acesso_realizado = true)::int         AS com_acesso,
    COUNT(v.id) FILTER (WHERE v.acesso_realizado = false)::int        AS sem_acesso,
    COUNT(DISTINCT v.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM vistoria_depositos d
        WHERE d.vistoria_id = v.id AND d.qtd_com_focos > 0
      )
    )::int                                                            AS imoveis_com_foco,
    COUNT(DISTINCT v.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM vistoria_depositos d
        WHERE d.vistoria_id = v.id AND d.usou_larvicida = true
      )
    )::int                                                            AS larvicida_aplicado,
    ROUND(
      COUNT(v.id) FILTER (WHERE v.acesso_realizado = true)::numeric
      / NULLIF(COUNT(v.id), 0) * 100, 1
    )                                                                 AS taxa_acesso,
    ROUND(
      COUNT(v.id) FILTER (WHERE v.acesso_realizado = true)::numeric
      / NULLIF(COUNT(DISTINCT v.data_visita), 0), 1
    )                                                                 AS media_depositos_dia
  FROM vistorias v
  JOIN usuarios u ON u.id = v.agente_id
  WHERE v.cliente_id = p_cliente_id
    AND v.ciclo = p_ciclo
  GROUP BY v.agente_id, u.nome
  ORDER BY total_visitas DESC;
$$;
