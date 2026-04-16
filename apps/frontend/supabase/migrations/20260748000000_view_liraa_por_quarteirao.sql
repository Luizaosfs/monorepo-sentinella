-- View LIRAa por quarteirão, ciclo e cliente
-- Agrega dados de vistorias e vistoria_depositos
-- Usada pelo relatório LIRAa da página AdminLiraa

CREATE OR REPLACE VIEW v_liraa_quarteirao
WITH (security_invoker = true)
AS
SELECT
  v.cliente_id,
  v.ciclo,
  im.bairro,
  im.quarteirao,
  COUNT(DISTINCT v.imovel_id) AS imoveis_inspecionados,
  COUNT(DISTINCT CASE WHEN vd_pos.vistoria_id IS NOT NULL THEN v.imovel_id END) AS imoveis_positivos,
  ROUND(
    CASE WHEN COUNT(DISTINCT v.imovel_id) > 0
    THEN (COUNT(DISTINCT CASE WHEN vd_pos.vistoria_id IS NOT NULL THEN v.imovel_id END)::numeric
          / COUNT(DISTINCT v.imovel_id)) * 100
    ELSE 0 END, 1
  ) AS iip,
  COALESCE(SUM(vd.qtd_com_focos), 0) AS total_focos,
  ROUND(
    CASE WHEN COUNT(DISTINCT v.imovel_id) > 0
    THEN (COALESCE(SUM(vd.qtd_com_focos), 0)::numeric
          / COUNT(DISTINCT v.imovel_id)) * 100
    ELSE 0 END, 1
  ) AS ibp,
  COALESCE(SUM(CASE WHEN vd.tipo = 'A1' THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_a1,
  COALESCE(SUM(CASE WHEN vd.tipo = 'A2' THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_a2,
  COALESCE(SUM(CASE WHEN vd.tipo = 'B'  THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_b,
  COALESCE(SUM(CASE WHEN vd.tipo = 'C'  THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_c,
  COALESCE(SUM(CASE WHEN vd.tipo = 'D1' THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_d1,
  COALESCE(SUM(CASE WHEN vd.tipo = 'D2' THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_d2,
  COALESCE(SUM(CASE WHEN vd.tipo = 'E'  THEN vd.qtd_com_focos ELSE 0 END), 0) AS focos_e,
  COALESCE(SUM(CASE WHEN vd.usou_larvicida THEN vd.qtd_larvicida_g ELSE 0 END), 0) AS larvicida_total_g
FROM vistorias v
JOIN imoveis im ON im.id = v.imovel_id
LEFT JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
LEFT JOIN LATERAL (
  SELECT DISTINCT vd2.vistoria_id
  FROM vistoria_depositos vd2
  WHERE vd2.vistoria_id = v.id
    AND vd2.qtd_com_focos > 0
  LIMIT 1
) vd_pos ON true
WHERE v.acesso_realizado = true
  AND v.deleted_at IS NULL
  AND im.deleted_at IS NULL
GROUP BY v.cliente_id, v.ciclo, im.bairro, im.quarteirao;

GRANT SELECT ON v_liraa_quarteirao TO authenticated;

COMMENT ON VIEW v_liraa_quarteirao IS
  'LIRAa por quarteirão: IIP, IBP e focos por tipo de depósito PNCD. '
  'Agrega vistorias com acesso_realizado=true. security_invoker=true herda RLS do usuário.';
