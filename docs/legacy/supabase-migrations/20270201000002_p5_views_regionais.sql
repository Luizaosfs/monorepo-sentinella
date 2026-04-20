-- =============================================================================
-- P5: Analista Regional — Views analíticas agregadas
--
-- Princípios de segurança:
--   - security_invoker = false → view roda como o dono (bypass RLS das tabelas base)
--   - Filtragem interna via auth.uid() + agrupamento_cliente
--   - Somente dados AGREGADOS — nenhum PII, endereço, nome de imóvel ou foto
--   - GRANT apenas para authenticated (analista + admin)
--
-- Views criadas:
--   D1. v_regional_kpi_municipio   — KPI geral por município
--   D2. v_regional_sla_municipio   — distribuição de SLA por município
--   D3. v_regional_uso_sistema     — uso do sistema (piloto_eventos) por município
-- =============================================================================

-- =============================================================================
-- D1. v_regional_kpi_municipio
-- =============================================================================

DROP VIEW IF EXISTS public.v_regional_kpi_municipio;

CREATE VIEW public.v_regional_kpi_municipio
WITH (security_invoker = false)
AS
SELECT
  c.id                                                        AS cliente_id,
  c.nome                                                      AS municipio_nome,
  c.cidade,
  c.uf,
  -- totais por status
  COUNT(f.id)                                                 AS total_focos,
  COUNT(f.id) FILTER (WHERE f.status = 'suspeita')            AS focos_suspeita,
  COUNT(f.id) FILTER (WHERE f.status = 'em_triagem')          AS focos_em_triagem,
  COUNT(f.id) FILTER (WHERE f.status = 'aguarda_inspecao')    AS focos_aguarda_inspecao,
  COUNT(f.id) FILTER (WHERE f.status IN ('em_inspecao','confirmado','em_tratamento'))
                                                              AS focos_ativos,
  COUNT(f.id) FILTER (WHERE f.status = 'confirmado')          AS focos_confirmados,
  COUNT(f.id) FILTER (WHERE f.status = 'em_tratamento')       AS focos_em_tratamento,
  COUNT(f.id) FILTER (WHERE f.status = 'resolvido')           AS focos_resolvidos,
  COUNT(f.id) FILTER (WHERE f.status = 'descartado')          AS focos_descartados,
  -- taxa de resolução (excluindo suspeitas não confirmadas e descartados)
  ROUND(
    CASE
      WHEN COUNT(f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado')) > 0
      THEN COUNT(f.id) FILTER (WHERE f.status = 'resolvido')::numeric
         / COUNT(f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado'))::numeric * 100
      ELSE 0
    END, 1
  )                                                           AS taxa_resolucao_pct,
  -- tempo médio de resolução em horas (confirmado → resolvido)
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (f.resolvido_em - f.confirmado_em)) / 3600.0
    ) FILTER (WHERE f.resolvido_em IS NOT NULL AND f.confirmado_em IS NOT NULL)
  ::numeric, 1)                                              AS tempo_medio_resolucao_horas,
  -- SLA vencido: focos confirmados há mais de 72h e ainda não resolvidos
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
      AND f.confirmado_em IS NOT NULL
      AND f.confirmado_em < now() - INTERVAL '72 hours'
  )                                                           AS sla_vencido_count,
  now()                                                       AS calculado_em
FROM public.clientes c
LEFT JOIN public.focos_risco f
  ON f.cliente_id = c.id
  AND f.deleted_at IS NULL
WHERE
  c.ativo = true
  AND (c.deleted_at IS NULL OR c.deleted_at > now())
  -- Filtragem de acesso: admin vê tudo; analista_regional vê apenas os do agrupamento
  AND (
    public.is_admin()
    OR
    c.id IN (
      SELECT ac.cliente_id
      FROM   public.agrupamento_cliente ac
      JOIN   public.usuarios u ON u.agrupamento_id = ac.agrupamento_id
      WHERE  u.auth_id = auth.uid()
    )
  )
GROUP BY c.id, c.nome, c.cidade, c.uf;

GRANT SELECT ON public.v_regional_kpi_municipio TO authenticated;

COMMENT ON VIEW public.v_regional_kpi_municipio IS
  'KPI agregado por município para o papel analista_regional. '
  'security_invoker=false: acesso às tabelas base via owner. '
  'Filtragem interna por agrupamento_cliente. Sem PII.';

-- =============================================================================
-- D2. v_regional_sla_municipio
-- =============================================================================

DROP VIEW IF EXISTS public.v_regional_sla_municipio;

CREATE VIEW public.v_regional_sla_municipio
WITH (security_invoker = false)
AS
SELECT
  c.id                                                        AS cliente_id,
  c.nome                                                      AS municipio_nome,
  c.cidade,
  c.uf,
  -- apenas focos confirmados ou em tratamento (têm SLA correndo)
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
  )                                                           AS total_ativos,
  -- SLA OK: confirmado há menos de 12h
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
      AND f.confirmado_em >= now() - INTERVAL '12 hours'
  )                                                           AS sla_ok,
  -- SLA Atenção: 12–24h
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
      AND f.confirmado_em < now() - INTERVAL '12 hours'
      AND f.confirmado_em >= now() - INTERVAL '24 hours'
  )                                                           AS sla_atencao,
  -- SLA Crítico: 24–72h
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
      AND f.confirmado_em < now() - INTERVAL '24 hours'
      AND f.confirmado_em >= now() - INTERVAL '72 hours'
  )                                                           AS sla_critico,
  -- SLA Vencido: > 72h
  COUNT(f.id) FILTER (
    WHERE f.status IN ('confirmado','em_tratamento')
      AND f.confirmado_em < now() - INTERVAL '72 hours'
  )                                                           AS sla_vencido,
  now()                                                       AS calculado_em
FROM public.clientes c
LEFT JOIN public.focos_risco f
  ON f.cliente_id = c.id
  AND f.deleted_at IS NULL
WHERE
  c.ativo = true
  AND (c.deleted_at IS NULL OR c.deleted_at > now())
  AND (
    public.is_admin()
    OR
    c.id IN (
      SELECT ac.cliente_id
      FROM   public.agrupamento_cliente ac
      JOIN   public.usuarios u ON u.agrupamento_id = ac.agrupamento_id
      WHERE  u.auth_id = auth.uid()
    )
  )
GROUP BY c.id, c.nome, c.cidade, c.uf;

GRANT SELECT ON public.v_regional_sla_municipio TO authenticated;

COMMENT ON VIEW public.v_regional_sla_municipio IS
  'Distribuição de SLA (buckets 12h/24h/72h) por município para analista_regional. '
  'Sem PII — apenas contagens agregadas.';

-- =============================================================================
-- D3. v_regional_uso_sistema
-- Baseia-se em piloto_eventos para medir adoção operacional
-- =============================================================================

DROP VIEW IF EXISTS public.v_regional_uso_sistema;

CREATE VIEW public.v_regional_uso_sistema
WITH (security_invoker = false)
AS
SELECT
  c.id                                                        AS cliente_id,
  c.nome                                                      AS municipio_nome,
  c.cidade,
  c.uf,
  -- eventos nos últimos 7 dias
  COUNT(pe.id) FILTER (
    WHERE pe.created_at >= now() - INTERVAL '7 days'
  )                                                           AS eventos_7d,
  -- distribuições (triagem territorial)
  COUNT(pe.id) FILTER (
    WHERE pe.tipo IN ('triagem_distribuicao_lote','triagem_distribuicao_individual')
      AND pe.created_at >= now() - INTERVAL '7 days'
  )                                                           AS distribuicoes_7d,
  -- inspeções iniciadas
  COUNT(pe.id) FILTER (
    WHERE pe.tipo = 'foco_inspecao_iniciada'
      AND pe.created_at >= now() - INTERVAL '7 days'
  )                                                           AS inspecoes_iniciadas_7d,
  -- focos resolvidos (via evento)
  COUNT(pe.id) FILTER (
    WHERE pe.tipo = 'foco_resolvido'
      AND pe.created_at >= now() - INTERVAL '7 days'
  )                                                           AS focos_resolvidos_7d,
  MAX(pe.created_at)                                          AS ultimo_evento_em,
  now()                                                       AS calculado_em
FROM public.clientes c
LEFT JOIN public.piloto_eventos pe ON pe.cliente_id = c.id
WHERE
  c.ativo = true
  AND (c.deleted_at IS NULL OR c.deleted_at > now())
  AND (
    public.is_admin()
    OR
    c.id IN (
      SELECT ac.cliente_id
      FROM   public.agrupamento_cliente ac
      JOIN   public.usuarios u ON u.agrupamento_id = ac.agrupamento_id
      WHERE  u.auth_id = auth.uid()
    )
  )
GROUP BY c.id, c.nome, c.cidade, c.uf;

GRANT SELECT ON public.v_regional_uso_sistema TO authenticated;

COMMENT ON VIEW public.v_regional_uso_sistema IS
  'Uso operacional do sistema nos últimos 7 dias por município, '
  'baseado em piloto_eventos. Para analista_regional — sem PII.';
