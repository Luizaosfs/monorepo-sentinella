-- Migration: Views para Painel Executivo Municipal
-- Criado em: 2026-07-54
-- Módulo: PainelExecutivo

-- ============================================================
-- 1. v_executivo_kpis — KPIs estratégicos da semana atual
-- ============================================================
CREATE OR REPLACE VIEW v_executivo_kpis
WITH (security_invoker = true)
AS
WITH cliente AS (
  SELECT cliente_id
  FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1
),
sla_stats AS (
  SELECT
    so.cliente_id,
    COUNT(*) FILTER (WHERE so.status = 'vencido' AND so.violado = true AND so.deleted_at IS NULL) AS slas_vencidos,
    COUNT(*) FILTER (WHERE so.deleted_at IS NULL) AS total_slas
  FROM sla_operacional so
  JOIN cliente c ON so.cliente_id = c.cliente_id
  GROUP BY so.cliente_id
),
focos_stats AS (
  SELECT
    fr.cliente_id,
    COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido', 'descartado')) AS total_focos_ativos,
    COUNT(*) FILTER (WHERE fr.created_at >= CURRENT_DATE - INTERVAL '7 days') AS focos_novos_semana,
    COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE - INTERVAL '7 days') AS focos_resolvidos_semana
  FROM focos_risco fr
  JOIN cliente c ON fr.cliente_id = c.cliente_id
  WHERE fr.deleted_at IS NULL
  GROUP BY fr.cliente_id
),
vistorias_stats AS (
  SELECT
    v.cliente_id,
    COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true AND v.created_at >= CURRENT_DATE - INTERVAL '7 days') AS imoveis_visitados_semana,
    COUNT(DISTINCT v.agente_id) FILTER (WHERE v.created_at >= CURRENT_DATE - INTERVAL '7 days') AS agentes_ativos_semana
  FROM vistorias v
  JOIN cliente c ON v.cliente_id = c.cliente_id
  WHERE v.deleted_at IS NULL
  GROUP BY v.cliente_id
),
imoveis_stats AS (
  SELECT
    im.cliente_id,
    COUNT(*) FILTER (WHERE im.deleted_at IS NULL) AS total_imoveis
  FROM imoveis im
  JOIN cliente c ON im.cliente_id = c.cliente_id
  GROUP BY im.cliente_id
),
score_stats AS (
  SELECT
    ts.cliente_id,
    ROUND(AVG(ts.score)::numeric, 1) AS score_medio,
    COUNT(*) FILTER (WHERE ts.classificacao = 'critico') AS imoveis_criticos
  FROM territorio_score ts
  JOIN cliente c ON ts.cliente_id = c.cliente_id
  GROUP BY ts.cliente_id
),
casos_stats AS (
  SELECT
    cn.cliente_id,
    COUNT(*) FILTER (WHERE cn.created_at >= CURRENT_DATE - INTERVAL '7 days') AS casos_novos_semana
  FROM casos_notificados cn
  JOIN cliente c ON cn.cliente_id = c.cliente_id
  WHERE cn.deleted_at IS NULL
  GROUP BY cn.cliente_id
)
SELECT
  c.cliente_id,
  date_trunc('week', CURRENT_DATE)::date AS semana_ref,
  COALESCE(fs.total_focos_ativos, 0) AS total_focos_ativos,
  COALESCE(fs.focos_novos_semana, 0) AS focos_novos_semana,
  COALESCE(fs.focos_resolvidos_semana, 0) AS focos_resolvidos_semana,
  ROUND(
    COALESCE(fs.focos_resolvidos_semana, 0) * 100.0
    / NULLIF(COALESCE(fs.focos_novos_semana, 0) + COALESCE(fs.focos_resolvidos_semana, 0), 0),
    1
  ) AS taxa_resolucao_pct,
  COALESCE(ss.slas_vencidos, 0) AS slas_vencidos,
  ROUND(
    (COALESCE(ss.total_slas, 0) - COALESCE(ss.slas_vencidos, 0)) * 100.0
    / NULLIF(COALESCE(ss.total_slas, 0), 0),
    1
  ) AS sla_conformidade_pct,
  COALESCE(vs.imoveis_visitados_semana, 0) AS imoveis_visitados_semana,
  ROUND(
    COALESCE(vs.imoveis_visitados_semana, 0) * 100.0
    / NULLIF(COALESCE(ims.total_imoveis, 0), 0),
    1
  ) AS cobertura_pct,
  scs.score_medio,
  COALESCE(scs.imoveis_criticos, 0) AS imoveis_criticos,
  COALESCE(cas.casos_novos_semana, 0) AS casos_novos_semana,
  COALESCE(vs.agentes_ativos_semana, 0) AS agentes_ativos_semana
FROM cliente c
LEFT JOIN focos_stats fs ON fs.cliente_id = c.cliente_id
LEFT JOIN sla_stats ss ON ss.cliente_id = c.cliente_id
LEFT JOIN vistorias_stats vs ON vs.cliente_id = c.cliente_id
LEFT JOIN imoveis_stats ims ON ims.cliente_id = c.cliente_id
LEFT JOIN score_stats scs ON scs.cliente_id = c.cliente_id
LEFT JOIN casos_stats cas ON cas.cliente_id = c.cliente_id;

GRANT SELECT ON v_executivo_kpis TO authenticated;

-- ============================================================
-- 2. v_executivo_tendencia — Tendência das últimas 8 semanas
-- ============================================================
CREATE OR REPLACE VIEW v_executivo_tendencia
WITH (security_invoker = true)
AS
WITH cliente AS (
  SELECT cliente_id
  FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1
),
weeks AS (
  SELECT generate_series(
    date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks',
    date_trunc('week', CURRENT_DATE),
    INTERVAL '1 week'
  )::date AS semana_inicio
),
score_stats AS (
  SELECT
    ts.cliente_id,
    ROUND(AVG(ts.score)::numeric, 1) AS score_medio
  FROM territorio_score ts
  JOIN cliente c ON ts.cliente_id = c.cliente_id
  GROUP BY ts.cliente_id
)
SELECT
  c.cliente_id,
  w.semana_inicio,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.created_at >= w.semana_inicio
      AND fr.created_at < w.semana_inicio + INTERVAL '7 days'
  ) AS focos_novos,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.resolvido_em >= w.semana_inicio
      AND fr.resolvido_em < w.semana_inicio + INTERVAL '7 days'
  ) AS focos_resolvidos,
  COUNT(DISTINCT v.id) FILTER (
    WHERE v.data_visita >= w.semana_inicio
      AND v.data_visita < w.semana_inicio + INTERVAL '7 days'
  ) AS vistorias,
  COUNT(DISTINCT cn.id) FILTER (
    WHERE cn.created_at >= w.semana_inicio
      AND cn.created_at < w.semana_inicio + INTERVAL '7 days'
  ) AS casos,
  ss.score_medio
FROM cliente c
CROSS JOIN weeks w
LEFT JOIN focos_risco fr ON fr.cliente_id = c.cliente_id AND fr.deleted_at IS NULL
LEFT JOIN vistorias v ON v.cliente_id = c.cliente_id AND v.deleted_at IS NULL
LEFT JOIN casos_notificados cn ON cn.cliente_id = c.cliente_id AND cn.deleted_at IS NULL
LEFT JOIN score_stats ss ON ss.cliente_id = c.cliente_id
GROUP BY c.cliente_id, w.semana_inicio, ss.score_medio
ORDER BY w.semana_inicio;

GRANT SELECT ON v_executivo_tendencia TO authenticated;

-- ============================================================
-- 3. v_executivo_cobertura — Cobertura territorial por bairro
-- ============================================================
CREATE OR REPLACE VIEW v_executivo_cobertura
WITH (security_invoker = true)
AS
WITH cliente AS (
  SELECT cliente_id
  FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1
)
SELECT
  im.cliente_id,
  im.bairro,
  COUNT(DISTINCT im.id) AS total_imoveis,
  COUNT(DISTINCT v.imovel_id) FILTER (
    WHERE v.acesso_realizado = true
      AND v.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS imoveis_visitados_30d,
  ROUND(
    COUNT(DISTINCT v.imovel_id) FILTER (
      WHERE v.acesso_realizado = true
        AND v.created_at >= CURRENT_DATE - INTERVAL '30 days'
    ) * 100.0
    / NULLIF(COUNT(DISTINCT im.id), 0),
    1
  ) AS cobertura_pct,
  ROUND(AVG(ts.score)::numeric, 1) AS score_medio_bairro,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.status NOT IN ('resolvido', 'descartado')
  ) AS focos_ativos,
  COUNT(DISTINCT ts2.imovel_id) FILTER (
    WHERE ts2.classificacao IN ('critico', 'muito_alto')
  ) AS imoveis_criticos
FROM imoveis im
JOIN cliente c ON im.cliente_id = c.cliente_id
LEFT JOIN vistorias v ON v.imovel_id = im.id AND v.deleted_at IS NULL
LEFT JOIN territorio_score ts ON ts.imovel_id = im.id AND ts.cliente_id = im.cliente_id
LEFT JOIN focos_risco fr ON fr.imovel_id = im.id AND fr.deleted_at IS NULL
LEFT JOIN territorio_score ts2 ON ts2.imovel_id = im.id AND ts2.cliente_id = im.cliente_id
WHERE im.deleted_at IS NULL
GROUP BY im.cliente_id, im.bairro
ORDER BY focos_ativos DESC, score_medio_bairro DESC NULLS LAST;

GRANT SELECT ON v_executivo_cobertura TO authenticated;

-- ============================================================
-- 4. v_executivo_bairros_variacao — Ranking de bairros por score e atividade
-- ============================================================
CREATE OR REPLACE VIEW v_executivo_bairros_variacao
WITH (security_invoker = true)
AS
WITH cliente AS (
  SELECT cliente_id
  FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1
),
base AS (
  SELECT
    im.cliente_id,
    im.bairro,
    im.id AS imovel_id
  FROM imoveis im
  JOIN cliente c ON im.cliente_id = c.cliente_id
  WHERE im.deleted_at IS NULL
)
SELECT
  b.cliente_id,
  b.bairro,
  ROUND(AVG(ts.score)::numeric, 1) AS score_atual,
  COUNT(DISTINCT fr7.id) AS focos_novos_7d,
  COUNT(DISTINCT fr30.id) AS focos_novos_30d,
  COUNT(DISTINCT cn.id) AS casos_30d,
  COUNT(DISTINCT v.id) AS vistorias_30d,
  ROUND(
    (COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric,
    1
  ) AS variacao_focos,
  CASE
    WHEN ROUND((COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric, 1) > 2 THEN 'piorando'
    WHEN ROUND((COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric, 1) < -2 THEN 'melhorando'
    ELSE 'estavel'
  END AS classificacao_tendencia
FROM base b
LEFT JOIN territorio_score ts ON ts.imovel_id = b.imovel_id AND ts.cliente_id = b.cliente_id
LEFT JOIN focos_risco fr7 ON fr7.imovel_id = b.imovel_id
  AND fr7.deleted_at IS NULL
  AND fr7.created_at >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN focos_risco fr30 ON fr30.imovel_id = b.imovel_id
  AND fr30.deleted_at IS NULL
  AND fr30.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN casos_notificados cn ON cn.cliente_id = b.cliente_id
  AND cn.bairro = b.bairro
  AND cn.deleted_at IS NULL
  AND cn.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN vistorias v ON v.imovel_id = b.imovel_id
  AND v.deleted_at IS NULL
  AND v.acesso_realizado = true
  AND v.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.cliente_id, b.bairro
ORDER BY score_atual DESC NULLS LAST;

GRANT SELECT ON v_executivo_bairros_variacao TO authenticated;

-- ============================================================
-- 5. v_executivo_comparativo_ciclos — Comparativo entre ciclos epidemiológicos
-- ============================================================
CREATE OR REPLACE VIEW v_executivo_comparativo_ciclos
WITH (security_invoker = true)
AS
WITH cliente AS (
  SELECT cliente_id
  FROM usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1
),
ciclos AS (
  SELECT
    (date_trunc('month', CURRENT_DATE)
      - ((EXTRACT(MONTH FROM CURRENT_DATE)::int % 2) * INTERVAL '1 month'))::date
      AS ciclo_atual_inicio,
    (date_trunc('month', CURRENT_DATE)
      - ((EXTRACT(MONTH FROM CURRENT_DATE)::int % 2) * INTERVAL '1 month')
      - INTERVAL '2 months')::date
      AS ciclo_anterior_inicio
)
SELECT
  c.cliente_id,
  ci.ciclo_atual_inicio,
  ci.ciclo_anterior_inicio,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.created_at >= ci.ciclo_atual_inicio
      AND fr.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months'
  ) AS focos_atual,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.created_at >= ci.ciclo_anterior_inicio
      AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months'
  ) AS focos_anterior,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.resolvido_em >= ci.ciclo_atual_inicio
      AND fr.resolvido_em < ci.ciclo_atual_inicio + INTERVAL '2 months'
  ) AS resolucao_atual,
  COUNT(DISTINCT fr.id) FILTER (
    WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio
      AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months'
  ) AS resolucao_anterior,
  COUNT(DISTINCT v.id) FILTER (
    WHERE v.data_visita >= ci.ciclo_atual_inicio
      AND v.data_visita < ci.ciclo_atual_inicio + INTERVAL '2 months'
  ) AS vistorias_atual,
  COUNT(DISTINCT v.id) FILTER (
    WHERE v.data_visita >= ci.ciclo_anterior_inicio
      AND v.data_visita < ci.ciclo_anterior_inicio + INTERVAL '2 months'
  ) AS vistorias_anterior,
  COUNT(DISTINCT cn.id) FILTER (
    WHERE cn.created_at >= ci.ciclo_atual_inicio
      AND cn.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months'
  ) AS casos_atual,
  COUNT(DISTINCT cn.id) FILTER (
    WHERE cn.created_at >= ci.ciclo_anterior_inicio
      AND cn.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months'
  ) AS casos_anterior,
  ROUND(
    (
      COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.created_at >= ci.ciclo_atual_inicio
          AND fr.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months'
      )
      - COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.created_at >= ci.ciclo_anterior_inicio
          AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months'
      )
    ) * 100.0
    / NULLIF(
      COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.created_at >= ci.ciclo_anterior_inicio
          AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months'
      ), 0
    ),
    1
  ) AS variacao_focos_pct,
  ROUND(
    (
      COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.resolvido_em >= ci.ciclo_atual_inicio
          AND fr.resolvido_em < ci.ciclo_atual_inicio + INTERVAL '2 months'
      )
      - COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio
          AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months'
      )
    ) * 100.0
    / NULLIF(
      COUNT(DISTINCT fr.id) FILTER (
        WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio
          AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months'
      ), 0
    ),
    1
  ) AS variacao_resolucao_pct
FROM cliente c
CROSS JOIN ciclos ci
LEFT JOIN focos_risco fr ON fr.cliente_id = c.cliente_id AND fr.deleted_at IS NULL
LEFT JOIN vistorias v ON v.cliente_id = c.cliente_id AND v.deleted_at IS NULL
LEFT JOIN casos_notificados cn ON cn.cliente_id = c.cliente_id AND cn.deleted_at IS NULL
GROUP BY c.cliente_id, ci.ciclo_atual_inicio, ci.ciclo_anterior_inicio;

GRANT SELECT ON v_executivo_comparativo_ciclos TO authenticated;
