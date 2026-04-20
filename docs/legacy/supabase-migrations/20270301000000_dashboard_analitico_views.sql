-- ─────────────────────────────────────────────────────────────────────────────
-- P8.2 — Dashboard Analítico Estratégico
-- Views analíticas baseadas nos campos de consolidação avançada da vistoria.
-- Todas com security_invoker=true — RLS de vistorias/imoveis aplicado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. RESUMO GERAL ──────────────────────────────────────────────────────────
-- KPIs macro por cliente: 1 row por cliente_id.

DROP VIEW IF EXISTS public.v_dashboard_analitico_resumo;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_resumo
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  COUNT(*)                                                                          AS total_vistorias,
  COUNT(*) FILTER (WHERE v.prioridade_final = 'P1')                                AS p1_count,
  COUNT(*) FILTER (WHERE v.prioridade_final = 'P2')                                AS p2_count,
  COUNT(*) FILTER (WHERE v.prioridade_final = 'P3')                                AS p3_count,
  COUNT(*) FILTER (WHERE v.prioridade_final = 'P4')                                AS p4_count,
  COUNT(*) FILTER (WHERE v.resultado_operacional = 'visitado')                     AS visitados_count,
  COUNT(*) FILTER (WHERE v.resultado_operacional IN ('sem_acesso','sem_acesso_retorno')) AS sem_acesso_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE v.resultado_operacional = 'visitado')
    / NULLIF(COUNT(*) FILTER (WHERE v.resultado_operacional IS NOT NULL), 0),
  1)                                                                                AS taxa_acesso_pct,
  COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')                               AS alertas_urgentes,
  COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar IN ('alta','critica'))        AS vulnerabilidade_alta_count,
  COUNT(*) FILTER (WHERE v.risco_vetorial IN ('alto','critico'))                   AS risco_vetorial_alto_count,
  COUNT(*) FILTER (WHERE v.risco_socioambiental = 'alto')                          AS risco_socio_alto_count
FROM public.vistorias v
WHERE v.deleted_at IS NULL
GROUP BY v.cliente_id;

COMMENT ON VIEW public.v_dashboard_analitico_resumo IS
  'KPIs macro da consolidação avançada de vistoria por cliente. security_invoker=true — RLS de vistorias aplicado. P8.2.';

-- ── 2. RISCO TERRITORIAL ─────────────────────────────────────────────────────
-- Agregado por bairro: % críticos, contagens de risco por dimensão.

DROP VIEW IF EXISTS public.v_dashboard_analitico_risco_territorial;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_risco_territorial
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  COALESCE(im.bairro, '(sem bairro)')                                              AS bairro,
  im.regiao_id,
  COUNT(*)                                                                          AS total_vistorias,
  COUNT(*) FILTER (WHERE v.prioridade_final IN ('P1','P2'))                        AS criticos_count,
  COUNT(*) FILTER (WHERE v.risco_vetorial IN ('alto','critico'))                   AS risco_vetorial_alto,
  COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar IN ('alta','critica'))        AS vulnerabilidade_alta,
  COUNT(*) FILTER (WHERE v.alerta_saude IN ('atencao','urgente'))                  AS alertas_saude,
  COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')                               AS alertas_urgentes,
  COUNT(*) FILTER (WHERE v.risco_socioambiental = 'alto')                          AS risco_socio_alto,
  COUNT(*) FILTER (WHERE v.resultado_operacional IN ('sem_acesso','sem_acesso_retorno')) AS sem_acesso_total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE v.prioridade_final IN ('P1','P2'))
    / NULLIF(COUNT(*), 0),
  1)                                                                                AS pct_criticos
FROM public.vistorias v
JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
WHERE v.deleted_at IS NULL
GROUP BY v.cliente_id, im.bairro, im.regiao_id;

COMMENT ON VIEW public.v_dashboard_analitico_risco_territorial IS
  'Risco agregado por bairro: % críticos, contagens vetorial/vulnerabilidade/saúde. P8.2.';

-- ── 3. DISTRIBUIÇÃO DE VULNERABILIDADE ───────────────────────────────────────

DROP VIEW IF EXISTS public.v_dashboard_analitico_vulnerabilidade;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_vulnerabilidade
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  COALESCE(im.bairro, '(sem bairro)')   AS bairro,
  v.vulnerabilidade_domiciliar,
  COUNT(*)                               AS total
FROM public.vistorias v
JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
WHERE v.deleted_at IS NULL
  AND v.vulnerabilidade_domiciliar IS NOT NULL
GROUP BY v.cliente_id, im.bairro, v.vulnerabilidade_domiciliar;

COMMENT ON VIEW public.v_dashboard_analitico_vulnerabilidade IS
  'Distribuição de vulnerabilidade_domiciliar por bairro. P8.2.';

-- ── 4. DISTRIBUIÇÃO DE ALERTA DE SAÚDE ───────────────────────────────────────

DROP VIEW IF EXISTS public.v_dashboard_analitico_alerta_saude;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_alerta_saude
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  COALESCE(im.bairro, '(sem bairro)')   AS bairro,
  v.alerta_saude,
  COUNT(*)                               AS total
FROM public.vistorias v
JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
WHERE v.deleted_at IS NULL
  AND v.alerta_saude IS NOT NULL
GROUP BY v.cliente_id, im.bairro, v.alerta_saude;

COMMENT ON VIEW public.v_dashboard_analitico_alerta_saude IS
  'Distribuição de alerta_saude por bairro. P8.2.';

-- ── 5. RESULTADO OPERACIONAL ──────────────────────────────────────────────────

DROP VIEW IF EXISTS public.v_dashboard_analitico_resultado_operacional;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_resultado_operacional
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  COALESCE(im.bairro, '(sem bairro)')   AS bairro,
  v.resultado_operacional,
  COUNT(*)                               AS total
FROM public.vistorias v
JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
WHERE v.deleted_at IS NULL
  AND v.resultado_operacional IS NOT NULL
GROUP BY v.cliente_id, im.bairro, v.resultado_operacional;

COMMENT ON VIEW public.v_dashboard_analitico_resultado_operacional IS
  'Distribuição de resultado_operacional por bairro. P8.2.';

-- ── 6. IMÓVEIS CRÍTICOS ───────────────────────────────────────────────────────
-- Vistorias P1/P2 com todas as dimensões expostas.
-- Inclui score de criticidade (0-4): quantas dimensões em nível alto/crítico.

DROP VIEW IF EXISTS public.v_dashboard_analitico_imoveis_criticos;

CREATE OR REPLACE VIEW public.v_dashboard_analitico_imoveis_criticos
  WITH (security_invoker = true) AS
SELECT
  v.cliente_id,
  v.imovel_id,
  im.logradouro,
  im.numero,
  im.complemento,
  COALESCE(im.bairro, '(sem bairro)')   AS bairro,
  im.regiao_id,
  v.id                                  AS vistoria_id,
  v.data_visita,
  v.prioridade_final,
  v.prioridade_motivo,
  v.resultado_operacional,
  v.vulnerabilidade_domiciliar,
  v.alerta_saude,
  v.risco_socioambiental,
  v.risco_vetorial,
  -- score 0-4: número de dimensões em nível alto/crítico
  (
    CASE WHEN v.risco_vetorial           IN ('alto','critico')  THEN 1 ELSE 0 END +
    CASE WHEN v.vulnerabilidade_domiciliar IN ('alta','critica') THEN 1 ELSE 0 END +
    CASE WHEN v.alerta_saude              IN ('atencao','urgente') THEN 1 ELSE 0 END +
    CASE WHEN v.risco_socioambiental     = 'alto'               THEN 1 ELSE 0 END
  )                                     AS dimensoes_criticas_count
FROM public.vistorias v
JOIN public.imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
WHERE v.deleted_at IS NULL
  AND v.prioridade_final IN ('P1', 'P2');

COMMENT ON VIEW public.v_dashboard_analitico_imoveis_criticos IS
  'Imóveis P1/P2 com todas as dimensões analíticas e score de criticidade (0-4). P8.2.';
