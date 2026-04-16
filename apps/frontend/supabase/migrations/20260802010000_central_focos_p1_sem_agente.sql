-- Migration: adiciona focos_p1_sem_agente em v_central_operacional
-- Usa CREATE OR REPLACE VIEW para não quebrar conexões ativas

CREATE OR REPLACE VIEW public.v_central_operacional
WITH (security_invoker = true) AS
SELECT
  u.cliente_id,
  CURRENT_DATE                                                             AS data_ref,
  COUNT(fr.id) FILTER (
    WHERE fr.status IN ('suspeita','em_triagem','aguarda_inspecao') AND fr.deleted_at IS NULL
  )                                                                        AS focos_pendentes,
  COUNT(fr.id) FILTER (
    WHERE fr.status IN ('confirmado','em_tratamento') AND fr.deleted_at IS NULL
  )                                                                        AS focos_em_atendimento,
  COUNT(fr.id) FILTER (
    WHERE fr.prioridade = 'P1'
      AND fr.responsavel_id IS NULL
      AND fr.status NOT IN ('resolvido','descartado')
      AND fr.deleted_at IS NULL
  )                                                                        AS focos_p1_sem_agente,
  COUNT(sla.id) FILTER (
    WHERE sla.status = 'vencido' AND sla.violado = true AND sla.deleted_at IS NULL
  )                                                                        AS slas_vencidos,
  COUNT(sla.id) FILTER (
    WHERE sla.status IN ('pendente','em_atendimento')
    AND sla.prazo_final <= now() + interval '2 hours'
    AND sla.prazo_final > now()
    AND sla.deleted_at IS NULL
  )                                                                        AS slas_vencendo_2h,
  COUNT(ts.imovel_id) FILTER (WHERE ts.classificacao = 'critico')         AS imoveis_criticos,
  COUNT(ts.imovel_id) FILTER (WHERE ts.classificacao = 'muito_alto')      AS imoveis_muito_alto,
  ROUND(AVG(ts.score), 1)                                                  AS score_medio_municipio,
  COUNT(DISTINCT v.id) FILTER (WHERE v.created_at::date = CURRENT_DATE AND v.deleted_at IS NULL)       AS vistorias_hoje,
  COUNT(DISTINCT v.agente_id) FILTER (WHERE v.created_at::date = CURRENT_DATE AND v.deleted_at IS NULL) AS agentes_ativos_hoje,
  COUNT(fr2.id) FILTER (
    WHERE fr2.origem_tipo = 'cidadao'
      AND fr2.status NOT IN ('resolvido','descartado')
      AND fr2.created_at >= now() - interval '24 hours'
      AND fr2.deleted_at IS NULL
  )                                                                        AS denuncias_ultimas_24h,
  COUNT(cn.id) FILTER (WHERE cn.created_at::date = CURRENT_DATE)         AS casos_hoje
FROM public.usuarios u
LEFT JOIN public.focos_risco fr      ON fr.cliente_id = u.cliente_id
LEFT JOIN public.focos_risco fr2     ON fr2.cliente_id = u.cliente_id
LEFT JOIN public.sla_operacional sla  ON sla.cliente_id = u.cliente_id
LEFT JOIN public.territorio_score ts  ON ts.cliente_id = u.cliente_id
LEFT JOIN public.vistorias v          ON v.cliente_id = u.cliente_id
LEFT JOIN public.casos_notificados cn ON cn.cliente_id = u.cliente_id
WHERE u.auth_id = auth.uid()
GROUP BY u.cliente_id;

GRANT SELECT ON public.v_central_operacional TO authenticated;
