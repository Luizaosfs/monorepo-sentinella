-- =============================================================================
-- rpc_score_surto_regioes — alinhar ao modelo focos_risco (pós-drop recorrência)
--
-- Antes: CTE recorrencia usava levantamento_item_recorrencia* (drop 20260803010000).
--        sla_venc só via levantamento_item_id (ignora SLA em foco_risco_id).
-- Depois: recorrência = focos_risco com foco_anterior_id (reincidência na cadeia).
--         SLA vencido: união levantamento_item_id (legado) + foco_risco_id.
--         Tenant: usuario_pode_acessar_cliente (SECURITY DEFINER).
-- Casos: exclui soft-deleted (deleted_at).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_score_surto_regioes(p_cliente_id uuid)
RETURNS TABLE (
  regiao_id          uuid,
  regiao_nome        text,
  score_total        numeric,
  classificacao      text,
  score_pluvio       numeric,
  score_recorrencia  numeric,
  score_casos        numeric,
  score_sla_vencido  numeric,
  total_casos_14d    int,
  total_focos_rec    int,
  prob_pluvio_max    numeric,
  sla_vencidos       int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'rpc_score_surto_regioes: acesso negado ao cliente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH
  pluvio AS (
    SELECT
      poi.bairro_nome,
      r.id AS regiao_id,
      COALESCE(MAX(poi.prob_final_max), 0) AS prob_pluvio
    FROM pluvio_operacional_run por
    JOIN pluvio_operacional_item poi ON poi.run_id = por.id
    LEFT JOIN regioes r ON r.regiao ILIKE poi.bairro_nome
      AND r.cliente_id = p_cliente_id
    WHERE por.cliente_id = p_cliente_id
      AND por.dt_ref = (
        SELECT MAX(dt_ref) FROM pluvio_operacional_run
        WHERE cliente_id = p_cliente_id
      )
    GROUP BY poi.bairro_nome, r.id
  ),
  recorrencia AS (
    SELECT
      fr.regiao_id,
      COUNT(*)::bigint AS total_recorrentes
    FROM focos_risco fr
    WHERE fr.cliente_id = p_cliente_id
      AND fr.regiao_id IS NOT NULL
      AND fr.deleted_at IS NULL
      AND fr.foco_anterior_id IS NOT NULL
    GROUP BY fr.regiao_id
  ),
  casos AS (
    SELECT
      cn.regiao_id,
      COUNT(*) AS total_casos
    FROM casos_notificados cn
    WHERE cn.cliente_id = p_cliente_id
      AND cn.deleted_at IS NULL
      AND cn.data_notificacao >= (now() - interval '14 days')::date
      AND cn.regiao_id IS NOT NULL
    GROUP BY cn.regiao_id
  ),
  sla_venc AS (
    SELECT
      u.regiao_id,
      COUNT(DISTINCT u.sla_id) AS sla_vencidos
    FROM (
      SELECT p.regiao_id AS regiao_id, so.id AS sla_id
      FROM sla_operacional so
      JOIN levantamento_itens li ON li.id = so.levantamento_item_id
        AND li.deleted_at IS NULL
      JOIN levantamentos lev ON lev.id = li.levantamento_id
      JOIN planejamento p ON p.id = lev.planejamento_id
      WHERE so.cliente_id = p_cliente_id
        AND so.status = 'vencido'
        AND so.deleted_at IS NULL
        AND p.regiao_id IS NOT NULL
        AND so.prazo_final >= now() - interval '30 days'
        AND so.levantamento_item_id IS NOT NULL

      UNION

      SELECT fr.regiao_id, so.id
      FROM sla_operacional so
      JOIN focos_risco fr ON fr.id = so.foco_risco_id
        AND fr.deleted_at IS NULL
      WHERE so.cliente_id = p_cliente_id
        AND so.status = 'vencido'
        AND so.deleted_at IS NULL
        AND fr.regiao_id IS NOT NULL
        AND so.prazo_final >= now() - interval '30 days'
        AND so.foco_risco_id IS NOT NULL
    ) u
    GROUP BY u.regiao_id
  )
  SELECT
    reg.id                                            AS regiao_id,
    reg.regiao                                        AS regiao_nome,
    ROUND(
      LEAST(100,
        COALESCE(p.prob_pluvio, 0) * 0.3 +
        LEAST(100, COALESCE(rec.total_recorrentes, 0) * 5) * 0.3 +
        LEAST(100, COALESCE(c.total_casos, 0) * 10) * 0.25 +
        LEAST(100, COALESCE(sv.sla_vencidos, 0) * 8) * 0.15
      ), 1
    )                                                 AS score_total,
    CASE
      WHEN LEAST(100, COALESCE(p.prob_pluvio,0)*0.3 + LEAST(100,COALESCE(rec.total_recorrentes,0)*5)*0.3 + LEAST(100,COALESCE(c.total_casos,0)*10)*0.25 + LEAST(100,COALESCE(sv.sla_vencidos,0)*8)*0.15) >= 80 THEN 'crítico'
      WHEN LEAST(100, COALESCE(p.prob_pluvio,0)*0.3 + LEAST(100,COALESCE(rec.total_recorrentes,0)*5)*0.3 + LEAST(100,COALESCE(c.total_casos,0)*10)*0.25 + LEAST(100,COALESCE(sv.sla_vencidos,0)*8)*0.15) >= 60 THEN 'alto'
      WHEN LEAST(100, COALESCE(p.prob_pluvio,0)*0.3 + LEAST(100,COALESCE(rec.total_recorrentes,0)*5)*0.3 + LEAST(100,COALESCE(c.total_casos,0)*10)*0.25 + LEAST(100,COALESCE(sv.sla_vencidos,0)*8)*0.15) >= 30 THEN 'moderado'
      ELSE 'baixo'
    END                                               AS classificacao,
    ROUND(COALESCE(p.prob_pluvio, 0) * 0.3, 1)      AS score_pluvio,
    ROUND(LEAST(100, COALESCE(rec.total_recorrentes, 0) * 5) * 0.3, 1) AS score_recorrencia,
    ROUND(LEAST(100, COALESCE(c.total_casos, 0) * 10) * 0.25, 1)       AS score_casos,
    ROUND(LEAST(100, COALESCE(sv.sla_vencidos, 0) * 8) * 0.15, 1)      AS score_sla_vencido,
    COALESCE(c.total_casos, 0)::int                   AS total_casos_14d,
    COALESCE(rec.total_recorrentes, 0)::int           AS total_focos_rec,
    COALESCE(p.prob_pluvio, 0)                        AS prob_pluvio_max,
    COALESCE(sv.sla_vencidos, 0)::int                 AS sla_vencidos
  FROM regioes reg
  LEFT JOIN pluvio p ON p.regiao_id = reg.id
  LEFT JOIN recorrencia rec ON rec.regiao_id = reg.id
  LEFT JOIN casos c ON c.regiao_id = reg.id
  LEFT JOIN sla_venc sv ON sv.regiao_id = reg.id
  WHERE reg.cliente_id = p_cliente_id
  ORDER BY score_total DESC;
END;
$$;

COMMENT ON FUNCTION public.rpc_score_surto_regioes(uuid) IS
  'Score preditivo de surto por região: pluvio, reincidência focos_risco (foco_anterior_id), casos 14d, SLA vencido (item legado + foco). Tenant: usuario_pode_acessar_cliente.';
