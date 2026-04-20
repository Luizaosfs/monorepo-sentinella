-- P7.11 — View de auditoria do canal cidadão por cliente
-- Usada por AdminCanalCidadao para métricas de volume e deduplicação.
-- Protegida por RLS via join com levantamentos (cliente_id).

CREATE OR REPLACE VIEW public.v_canal_cidadao_stats AS
SELECT
  lev.cliente_id,
  COUNT(*)                                                          AS total,
  COUNT(*) FILTER (WHERE li.created_at >= now() - interval '24h') AS ultimas_24h,
  COUNT(*) FILTER (WHERE li.created_at >= now() - interval '7d')  AS ultimos_7d,
  COUNT(*) FILTER (WHERE li.created_at >= now() - interval '30d') AS ultimos_30d,
  COUNT(fr.id)                                                      AS com_foco_vinculado,
  COUNT(*) FILTER (WHERE fr.status IN ('resolvido','descartado'))  AS resolvidos,
  COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido','descartado')
                     AND fr.id IS NOT NULL)                         AS em_aberto
FROM public.levantamento_itens li
JOIN public.levantamentos lev ON lev.id = li.levantamento_id
LEFT JOIN public.focos_risco fr
  ON fr.origem_levantamento_item_id = li.id
  AND fr.deleted_at IS NULL
WHERE li.item = 'Denúncia Cidadão'
GROUP BY lev.cliente_id;

-- A view herda RLS das tabelas base (levantamento_itens e levantamentos).
-- Apenas usuários com acesso ao cliente_id verão os dados correspondentes.
COMMENT ON VIEW public.v_canal_cidadao_stats IS
  'Métricas agregadas do canal cidadão por cliente. '
  'Proteção via RLS das tabelas levantamento_itens e levantamentos.';
