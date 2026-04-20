-- ── P3: Adiciona ct_sem_responsavel à view v_focos_risco_agrupados ─────────────
-- Permite filtrar grupos que ainda não têm todos os focos atribuídos.

DROP VIEW IF EXISTS public.v_focos_risco_agrupados;

CREATE VIEW public.v_focos_risco_agrupados AS
SELECT
  f.cliente_id,

  -- Tipo do agrupamento (hierarquia: quadra > bairro > regiao > item)
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN 'quadra'
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN 'bairro'
    WHEN r.id         IS NOT NULL                         THEN 'regiao'
    ELSE 'item'
  END::text AS agrupador_tipo,

  -- Valor legível do agrupamento
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN i.quarteirao
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN i.bairro
    WHEN r.id         IS NOT NULL                         THEN COALESCE(r.regiao, r.id::text)
    ELSE f.id::text
  END AS agrupador_valor,

  -- Contagens
  count(*)::int                                                               AS quantidade_focos,
  count(*) FILTER (WHERE f.status IN ('em_triagem', 'aguarda_inspecao'))::int AS quantidade_elegivel,
  count(*) FILTER (WHERE f.status = 'em_triagem')::int                       AS ct_em_triagem,
  count(*) FILTER (WHERE f.status = 'aguarda_inspecao')::int                 AS ct_aguarda_inspecao,
  count(*) FILTER (WHERE f.responsavel_id IS NULL)::int                      AS ct_sem_responsavel,

  -- Prioridade máxima do grupo (menor ordinal = maior urgência: P1=1 … P5=5)
  min(CASE f.prioridade
    WHEN 'P1' THEN 1
    WHEN 'P2' THEN 2
    WHEN 'P3' THEN 3
    WHEN 'P4' THEN 4
    WHEN 'P5' THEN 5
    ELSE 99
  END)::int AS prioridade_max_ord,

  -- Array de IDs ordenado por prioridade (para distribuição em lote)
  array_agg(f.id ORDER BY f.score_prioridade DESC NULLS LAST) AS foco_ids,

  -- Centróide aproximado do grupo
  avg(f.latitude)  AS lat_media,
  avg(f.longitude) AS lng_media

FROM public.focos_risco f
LEFT JOIN public.imoveis i ON i.id = f.imovel_id
LEFT JOIN public.regioes r ON r.id = f.regiao_id

WHERE f.deleted_at IS NULL
  AND f.status NOT IN ('resolvido', 'descartado')

GROUP BY
  f.cliente_id,
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN 'quadra'
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN 'bairro'
    WHEN r.id         IS NOT NULL                         THEN 'regiao'
    ELSE 'item'
  END,
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN i.quarteirao
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN i.bairro
    WHEN r.id         IS NOT NULL                         THEN COALESCE(r.regiao, r.id::text)
    ELSE f.id::text
  END;

COMMENT ON VIEW public.v_focos_risco_agrupados IS
  'Focos de risco ativos agrupados por território (quadra>bairro>regiao>item). '
  'Inclui contadores de status, ct_sem_responsavel e centróide do grupo.';
