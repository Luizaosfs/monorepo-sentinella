-- P7.7 — Observabilidade Operacional do Piloto
-- Views analíticas para triagem, despacho e campo.
-- Reaproveitam focos_risco + foco_risco_historico (audit append-only).
-- Sem ETL, sem tabelas espelho, sem duplicação de lógica.

-- ─────────────────────────────────────────────────────────────────────────────
-- Índice auxiliar — consultas de despacho no histórico por status_novo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_foco_historico_status_novo
  ON public.foco_risco_historico (cliente_id, status_novo, alterado_em DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- v_piloto_funil_hoje
-- Funil operacional do dia: entradas → triagem → despacho → campo → resolução
-- Uma linha por cliente. Período: hoje + 7 dias para médias históricas.
-- security_invoker=true: RLS de focos_risco e foco_risco_historico aplicado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_piloto_funil_hoje
WITH (security_invoker = true) AS
WITH primeiro_despacho AS (
  -- Primeiro momento em que cada foco foi despachado (status → aguarda_inspecao)
  SELECT DISTINCT ON (foco_risco_id)
    foco_risco_id,
    alterado_por  AS supervisor_id,
    alterado_em   AS despachado_em
  FROM public.foco_risco_historico
  WHERE status_novo = 'aguarda_inspecao'
  ORDER BY foco_risco_id, alterado_em ASC
)
SELECT
  fr.cliente_id,

  -- ── Entradas ──────────────────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE fr.suspeita_em >= CURRENT_DATE)                                              AS entradas_hoje,
  COUNT(*) FILTER (WHERE fr.suspeita_em >= CURRENT_DATE - INTERVAL '7 days')                         AS entradas_7d,

  -- ── Funil atual ───────────────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE fr.status IN ('suspeita','em_triagem'))                                      AS em_triagem_agora,
  COUNT(*) FILTER (WHERE fr.status = 'aguarda_inspecao')                                             AS aguarda_inspecao_agora,
  COUNT(*) FILTER (WHERE fr.status = 'em_inspecao')                                                  AS em_inspecao_agora,
  COUNT(*) FILTER (WHERE fr.status IN ('confirmado','em_tratamento'))                                AS em_tratamento_agora,
  COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido','descartado'))                                AS ativos_total,

  -- ── Resolução ─────────────────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE)               AS resolvidos_hoje,
  COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE - INTERVAL '7 days') AS resolvidos_7d,

  -- ── Despachos (fonte: foco_risco_historico) ───────────────────────────────
  COUNT(pd.foco_risco_id) FILTER (WHERE pd.despachado_em >= CURRENT_DATE)                           AS despachados_hoje,
  COUNT(pd.foco_risco_id) FILTER (WHERE pd.despachado_em >= CURRENT_DATE - INTERVAL '7 days')       AS despachados_7d,

  -- ── Alertas operacionais ─────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE fr.status IN ('suspeita','em_triagem') AND fr.responsavel_id IS NULL)      AS sem_responsavel_em_triagem,
  COUNT(*) FILTER (WHERE fr.status IN ('suspeita','em_triagem') AND NOW() - fr.suspeita_em > INTERVAL '24 hours') AS envelhecidos_24h,
  COUNT(*) FILTER (WHERE fr.status = 'aguarda_inspecao' AND NOW() - fr.suspeita_em > INTERVAL '48 hours') AS aguardando_envelhecidos_48h,

  -- ── Referências temporais ─────────────────────────────────────────────────
  MIN(fr.suspeita_em) FILTER (WHERE fr.status IN ('suspeita','em_triagem'))                         AS foco_mais_antigo_em,

  -- ── Tempo médio em triagem (suspeita_em → primeiro despacho), 7d ─────────
  ROUND(
    AVG(EXTRACT(EPOCH FROM (pd.despachado_em - fr.suspeita_em)) / 3600.0)
    FILTER (WHERE pd.despachado_em >= CURRENT_DATE - INTERVAL '7 days'),
  1) AS tempo_medio_triagem_7d_horas,

  -- ── Tempo médio suspeita → inspeção iniciada, 7d ─────────────────────────
  ROUND(
    AVG(EXTRACT(EPOCH FROM (fr.inspecao_em - fr.suspeita_em)) / 3600.0)
    FILTER (WHERE fr.inspecao_em IS NOT NULL AND fr.inspecao_em >= CURRENT_DATE - INTERVAL '7 days'),
  1) AS tempo_medio_suspeita_inspecao_7d_horas,

  -- ── Entradas por origem — hoje ────────────────────────────────────────────
  jsonb_build_object(
    'drone',   COUNT(*) FILTER (WHERE fr.origem_tipo = 'drone'   AND fr.suspeita_em >= CURRENT_DATE),
    'cidadao', COUNT(*) FILTER (WHERE fr.origem_tipo = 'cidadao' AND fr.suspeita_em >= CURRENT_DATE),
    'agente',  COUNT(*) FILTER (WHERE fr.origem_tipo = 'agente'  AND fr.suspeita_em >= CURRENT_DATE),
    'manual',  COUNT(*) FILTER (WHERE fr.origem_tipo = 'manual'  AND fr.suspeita_em >= CURRENT_DATE),
    'pluvio',  COUNT(*) FILTER (WHERE fr.origem_tipo = 'pluvio'  AND fr.suspeita_em >= CURRENT_DATE)
  ) AS entradas_por_origem_hoje

FROM public.focos_risco fr
LEFT JOIN primeiro_despacho pd ON pd.foco_risco_id = fr.id
WHERE fr.deleted_at IS NULL
GROUP BY fr.cliente_id;

COMMENT ON VIEW public.v_piloto_funil_hoje IS
  'Funil operacional do piloto: entradas → triagem → despacho → campo → resolução. '
  'Hoje + 7 dias. Tempo médio de triagem via foco_risco_historico (append-only). '
  'security_invoker=true — RLS garante isolamento por cliente.';

-- ─────────────────────────────────────────────────────────────────────────────
-- v_piloto_despachos_supervisor
-- Despachos por supervisor (quem despachou, volume, velocidade) — 7 dias
-- Fonte de verdade: foco_risco_historico (status_novo = 'aguarda_inspecao')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_piloto_despachos_supervisor
WITH (security_invoker = true) AS
WITH primeiro_despacho AS (
  SELECT DISTINCT ON (foco_risco_id)
    foco_risco_id,
    cliente_id,
    alterado_por AS supervisor_id,
    alterado_em  AS despachado_em
  FROM public.foco_risco_historico
  WHERE status_novo = 'aguarda_inspecao'
  ORDER BY foco_risco_id, alterado_em ASC
)
SELECT
  pd.cliente_id,
  pd.supervisor_id,
  u.nome                                                                                              AS supervisor_nome,
  COUNT(*) FILTER (WHERE pd.despachado_em >= CURRENT_DATE)                                          AS despachados_hoje,
  COUNT(*) FILTER (WHERE pd.despachado_em >= CURRENT_DATE - INTERVAL '7 days')                      AS despachados_7d,
  COUNT(*)                                                                                            AS despachados_total,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (pd.despachado_em - fr.suspeita_em)) / 3600.0)
    FILTER (WHERE pd.despachado_em >= CURRENT_DATE - INTERVAL '7 days'),
  1) AS tempo_medio_triagem_7d_horas
FROM primeiro_despacho pd
JOIN public.focos_risco fr ON fr.id = pd.foco_risco_id AND fr.deleted_at IS NULL
LEFT JOIN public.usuarios u ON u.id = pd.supervisor_id
GROUP BY pd.cliente_id, pd.supervisor_id, u.nome;

COMMENT ON VIEW public.v_piloto_despachos_supervisor IS
  'Produtividade de despacho por supervisor: volume hoje, 7d, total e tempo médio em triagem. '
  'security_invoker=true. Fonte: foco_risco_historico (append-only, imutável).';

-- ─────────────────────────────────────────────────────────────────────────────
-- v_piloto_prod_agentes
-- Produtividade dos agentes em campo via focos_risco por responsavel_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_piloto_prod_agentes
WITH (security_invoker = true) AS
SELECT
  fr.cliente_id,
  fr.responsavel_id                                                                                   AS agente_id,
  u.nome                                                                                              AS agente_nome,
  COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido','descartado'))                               AS atribuidos_ativos,
  COUNT(*) FILTER (WHERE fr.status = 'aguarda_inspecao')                                            AS aguardando,
  COUNT(*) FILTER (WHERE fr.status = 'em_inspecao')                                                 AS em_inspecao,
  COUNT(*) FILTER (WHERE fr.inspecao_em IS NOT NULL)                                                AS iniciados_total,
  COUNT(*) FILTER (WHERE fr.inspecao_em IS NOT NULL AND fr.inspecao_em >= CURRENT_DATE)             AS iniciados_hoje,
  COUNT(*) FILTER (WHERE fr.status = 'resolvido')                                                   AS resolvidos_total,
  COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE)               AS resolvidos_hoje,
  COUNT(*) FILTER (WHERE fr.status = 'aguarda_inspecao' AND NOW() - fr.suspeita_em > INTERVAL '48 hours') AS envelhecidos,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (fr.inspecao_em - fr.suspeita_em)) / 3600.0)
    FILTER (WHERE fr.inspecao_em IS NOT NULL),
  1) AS tempo_medio_despacho_inspecao_horas
FROM public.focos_risco fr
LEFT JOIN public.usuarios u ON u.id = fr.responsavel_id
WHERE fr.deleted_at IS NULL
  AND fr.responsavel_id IS NOT NULL
GROUP BY fr.cliente_id, fr.responsavel_id, u.nome;

COMMENT ON VIEW public.v_piloto_prod_agentes IS
  'Produtividade dos agentes em campo: atribuídos, iniciados, resolvidos, envelhecidos. '
  'Fonte: focos_risco por responsavel_id. security_invoker=true.';
