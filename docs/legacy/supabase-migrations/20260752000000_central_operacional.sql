-- =============================================================================
-- Central Operacional do Dia
-- Views para KPIs e imóveis prioritários para ação hoje
-- =============================================================================

-- View: KPIs do dia para o gestor (1 row por usuário logado)
CREATE OR REPLACE VIEW public.v_central_operacional
WITH (security_invoker = true) AS
SELECT
  u.cliente_id,
  CURRENT_DATE                                                             AS data_ref,
  -- Focos ativos por status
  COUNT(fr.id) FILTER (
    WHERE fr.status IN ('suspeita','em_triagem','aguarda_inspecao') AND fr.deleted_at IS NULL
  )                                                                        AS focos_pendentes,
  COUNT(fr.id) FILTER (
    WHERE fr.status IN ('confirmado','em_tratamento') AND fr.deleted_at IS NULL
  )                                                                        AS focos_em_atendimento,
  -- SLA
  COUNT(sla.id) FILTER (
    WHERE sla.status = 'vencido' AND sla.violado = true AND sla.deleted_at IS NULL
  )                                                                        AS slas_vencidos,
  COUNT(sla.id) FILTER (
    WHERE sla.status IN ('pendente','em_atendimento')
    AND sla.prazo_final <= now() + interval '2 hours'
    AND sla.prazo_final > now()
    AND sla.deleted_at IS NULL
  )                                                                        AS slas_vencendo_2h,
  -- Score territorial
  COUNT(ts.imovel_id) FILTER (WHERE ts.classificacao = 'critico')         AS imoveis_criticos,
  COUNT(ts.imovel_id) FILTER (WHERE ts.classificacao = 'muito_alto')      AS imoveis_muito_alto,
  ROUND(AVG(ts.score), 1)                                                  AS score_medio_municipio,
  -- Operação de hoje
  COUNT(DISTINCT v.id) FILTER (WHERE v.created_at::date = CURRENT_DATE AND v.deleted_at IS NULL)   AS vistorias_hoje,
  COUNT(DISTINCT v.agente_id) FILTER (WHERE v.created_at::date = CURRENT_DATE AND v.deleted_at IS NULL) AS agentes_ativos_hoje,
  -- Canal cidadão
  COUNT(fr2.id) FILTER (
    WHERE fr2.origem_tipo = 'cidadao'
    AND fr2.status NOT IN ('resolvido','descartado')
    AND fr2.created_at >= now() - interval '24 hours'
    AND fr2.deleted_at IS NULL
  )                                                                        AS denuncias_ultimas_24h,
  -- Casos notificados
  COUNT(cn.id) FILTER (WHERE cn.created_at::date = CURRENT_DATE)         AS casos_hoje
FROM public.usuarios u
LEFT JOIN public.focos_risco fr     ON fr.cliente_id = u.cliente_id
LEFT JOIN public.focos_risco fr2    ON fr2.cliente_id = u.cliente_id
LEFT JOIN public.sla_operacional sla ON sla.cliente_id = u.cliente_id
LEFT JOIN public.territorio_score ts ON ts.cliente_id = u.cliente_id
LEFT JOIN public.vistorias v         ON v.cliente_id = u.cliente_id
LEFT JOIN public.casos_notificados cn ON cn.cliente_id = u.cliente_id
WHERE u.auth_id = auth.uid()
GROUP BY u.cliente_id;

GRANT SELECT ON public.v_central_operacional TO authenticated;
COMMENT ON VIEW public.v_central_operacional IS
  'KPIs do dia para a Central Operacional. Um row por usuário logado. security_invoker garante isolamento multitenante.';

-- View: imóveis críticos para ação hoje
CREATE OR REPLACE VIEW public.v_imoveis_para_hoje
WITH (security_invoker = true) AS
SELECT
  ts.cliente_id,
  ts.imovel_id,
  ts.score,
  ts.classificacao,
  ts.fatores,
  ts.calculado_em,
  im.logradouro,
  im.numero,
  im.bairro,
  im.quarteirao,
  im.latitude,
  im.longitude,
  im.historico_recusa,
  im.prioridade_drone,
  MIN(sla.prazo_final) FILTER (WHERE sla.status IN ('pendente','em_atendimento') AND sla.deleted_at IS NULL) AS sla_mais_urgente,
  MAX(fr.prioridade) FILTER (WHERE fr.status NOT IN ('resolvido','descartado') AND fr.deleted_at IS NULL)    AS prioridade_foco_ativo,
  COUNT(fr.id) FILTER (WHERE fr.status NOT IN ('resolvido','descartado') AND fr.deleted_at IS NULL)          AS focos_ativos_count
FROM public.territorio_score ts
JOIN public.imoveis im ON im.id = ts.imovel_id AND im.deleted_at IS NULL
LEFT JOIN public.focos_risco fr ON fr.imovel_id = ts.imovel_id AND fr.deleted_at IS NULL
LEFT JOIN public.sla_operacional sla ON sla.foco_risco_id = fr.id AND sla.deleted_at IS NULL
WHERE ts.classificacao IN ('critico', 'muito_alto', 'alto')
GROUP BY ts.cliente_id, ts.imovel_id, ts.score, ts.classificacao,
         ts.fatores, ts.calculado_em,
         im.logradouro, im.numero, im.bairro, im.quarteirao,
         im.latitude, im.longitude, im.historico_recusa, im.prioridade_drone
ORDER BY ts.score DESC;

GRANT SELECT ON public.v_imoveis_para_hoje TO authenticated;
COMMENT ON VIEW public.v_imoveis_para_hoje IS
  'Imóveis com score alto/muito_alto/crítico para priorização diária. security_invoker = true.';

-- Nota: atualização de v_imovel_resumo com score está na migration 20260753.
