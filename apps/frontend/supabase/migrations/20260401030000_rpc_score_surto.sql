-- NOTA: versão atual da função está em 20260922000000_rpc_score_surto_focos_risco.sql
-- (remove dependência de levantamento_item_recorrencia* e inclui SLA por foco_risco_id).
--
-- Score preditivo de surto por região, combinando:
-- 1. Risco pluviométrico atual (prob_final_max da última run)
-- 2. Densidade de focos recorrentes por região
-- 3. Casos notificados nos últimos 14 dias
-- 4. Taxa de SLA vencido na região (focos ignorados = risco acumulado)

CREATE OR REPLACE FUNCTION public.rpc_score_surto_regioes(
  p_cliente_id uuid
)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Focos recorrentes: via tabela pivô → levantamento_itens → levantamentos → planejamentos → regiao_id
    SELECT
      p.regiao_id,
      COUNT(DISTINCT lir.id) AS total_recorrentes
    FROM levantamento_item_recorrencia lir
    JOIN levantamento_item_recorrencia_itens liri ON liri.recorrencia_id = lir.id
    JOIN levantamento_itens li ON li.id = liri.levantamento_item_id
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    JOIN planejamento p ON p.id = lev.planejamento_id
    WHERE lir.cliente_id = p_cliente_id
      AND p.regiao_id IS NOT NULL
    GROUP BY p.regiao_id
  ),
  casos AS (
    SELECT
      regiao_id,
      COUNT(*) AS total_casos
    FROM casos_notificados
    WHERE cliente_id = p_cliente_id
      AND data_notificacao >= now() - interval '14 days'
      AND regiao_id IS NOT NULL
    GROUP BY regiao_id
  ),
  sla_venc AS (
    -- SLAs vencidos via levantamento_itens → levantamentos → planejamentos → regiao_id
    SELECT
      p.regiao_id,
      COUNT(so.id) AS sla_vencidos
    FROM sla_operacional so
    JOIN levantamento_itens li ON li.id = so.levantamento_item_id
    JOIN levantamentos lev ON lev.id = li.levantamento_id
    JOIN planejamento p ON p.id = lev.planejamento_id
    WHERE so.cliente_id = p_cliente_id
      AND so.status = 'vencido'
      AND p.regiao_id IS NOT NULL
      AND so.prazo_final >= now() - interval '30 days'
    GROUP BY p.regiao_id
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
$$;
