-- =============================================================================
-- Atualiza v_imovel_resumo para incluir score territorial (módulo Imóvel 360°)
-- Usa DROP + CREATE porque CREATE OR REPLACE não permite alterar nomes de colunas.
-- Preserva exatamente as mesmas colunas da migration 20260749 + 4 novas de score.
-- =============================================================================

DROP VIEW IF EXISTS public.v_imovel_resumo;

CREATE VIEW public.v_imovel_resumo
WITH (security_invoker = true)
AS
SELECT
  im.id,
  im.cliente_id,
  im.bairro,
  im.quarteirao,
  im.logradouro,
  im.numero,
  im.tipo_imovel,
  im.latitude,
  im.longitude,
  im.historico_recusa,
  im.prioridade_drone,
  im.tem_calha,
  im.calha_acessivel,
  -- Vistorias
  COUNT(DISTINCT v.id)                                                               AS total_vistorias,
  MAX(v.data_visita)                                                                 AS ultima_visita,
  COUNT(DISTINCT CASE WHEN v.acesso_realizado = false THEN v.id END)                AS tentativas_sem_acesso,
  -- Focos
  COUNT(DISTINCT fr.id)                                                              AS total_focos_historico,
  COUNT(DISTINCT CASE WHEN fr.status NOT IN ('resolvido','descartado') THEN fr.id END) AS focos_ativos,
  MAX(fr.created_at)                                                                 AS ultimo_foco_em,
  -- SLA
  COUNT(DISTINCT CASE WHEN sla.status IN ('pendente','em_atendimento') THEN sla.id END) AS slas_abertos,
  -- Recorrência
  COUNT(DISTINCT CASE WHEN fr.foco_anterior_id IS NOT NULL THEN fr.id END)          AS focos_recorrentes,
  -- Score territorial (novo)
  ts.score                AS score_territorial,
  ts.classificacao        AS score_classificacao,
  ts.fatores              AS score_fatores,
  ts.calculado_em         AS score_calculado_em
FROM public.imoveis im
LEFT JOIN public.vistorias v         ON v.imovel_id = im.id AND v.deleted_at IS NULL
LEFT JOIN public.focos_risco fr      ON fr.imovel_id = im.id AND fr.deleted_at IS NULL
LEFT JOIN public.sla_operacional sla ON sla.foco_risco_id = fr.id
LEFT JOIN public.territorio_score ts ON ts.imovel_id = im.id AND ts.cliente_id = im.cliente_id
WHERE im.deleted_at IS NULL
GROUP BY im.id, ts.score, ts.classificacao, ts.fatores, ts.calculado_em;

GRANT SELECT ON public.v_imovel_resumo TO authenticated;

COMMENT ON VIEW public.v_imovel_resumo IS
  'Resumo territorial do imóvel: vistorias, focos históricos, SLA ativo, recorrência e score territorial. '
  'Base do módulo Imóvel 360°. security_invoker=true herda RLS do usuário.';
