-- v_central_operacional: evita produto cartesiano (JOIN só por cliente_id).
-- O plano anterior gerava |focos|×|sla|×|score|×|vistorias|×|casos| linhas antes do GROUP BY,
-- podendo estourar work_mem/timeout e retornar 500 via PostgREST.

DROP VIEW IF EXISTS public.v_central_operacional;

CREATE OR REPLACE VIEW public.v_central_operacional
WITH (security_invoker = true) AS
SELECT
  u.cliente_id,
  CURRENT_DATE AS data_ref,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.status IN ('suspeita', 'em_triagem', 'aguarda_inspecao')
      AND fr.deleted_at IS NULL
  ) AS focos_pendentes,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.status IN ('confirmado', 'em_tratamento')
      AND fr.deleted_at IS NULL
  ) AS focos_em_atendimento,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr
    WHERE fr.cliente_id = u.cliente_id
      AND fr.prioridade = 'P1'
      AND fr.responsavel_id IS NULL
      AND fr.status NOT IN ('resolvido', 'descartado')
      AND fr.deleted_at IS NULL
  ) AS focos_p1_sem_agente,
  (
    SELECT COUNT(*)::bigint
    FROM public.sla_operacional sla
    WHERE sla.cliente_id = u.cliente_id
      AND sla.status = 'vencido'
      AND sla.violado = true
      AND sla.deleted_at IS NULL
  ) AS slas_vencidos,
  (
    SELECT COUNT(*)::bigint
    FROM public.sla_operacional sla
    WHERE sla.cliente_id = u.cliente_id
      AND sla.status IN ('pendente', 'em_atendimento')
      AND sla.prazo_final <= now() + interval '2 hours'
      AND sla.prazo_final > now()
      AND sla.deleted_at IS NULL
  ) AS slas_vencendo_2h,
  (
    SELECT COUNT(*)::bigint
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
      AND ts.classificacao = 'critico'
  ) AS imoveis_criticos,
  (
    SELECT COUNT(*)::bigint
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
      AND ts.classificacao = 'muito_alto'
  ) AS imoveis_muito_alto,
  (
    SELECT ROUND(AVG(ts.score), 1)
    FROM public.territorio_score ts
    WHERE ts.cliente_id = u.cliente_id
  ) AS score_medio_municipio,
  (
    SELECT COUNT(*)::bigint
    FROM public.vistorias v
    WHERE v.cliente_id = u.cliente_id
      AND (v.created_at)::date = CURRENT_DATE
      AND v.deleted_at IS NULL
  ) AS vistorias_hoje,
  (
    SELECT COUNT(DISTINCT v.agente_id)::bigint
    FROM public.vistorias v
    WHERE v.cliente_id = u.cliente_id
      AND (v.created_at)::date = CURRENT_DATE
      AND v.deleted_at IS NULL
  ) AS agentes_ativos_hoje,
  (
    SELECT COUNT(*)::bigint
    FROM public.focos_risco fr2
    WHERE fr2.cliente_id = u.cliente_id
      AND fr2.origem_tipo = 'cidadao'
      AND fr2.status NOT IN ('resolvido', 'descartado')
      AND fr2.created_at >= now() - interval '24 hours'
      AND fr2.deleted_at IS NULL
  ) AS denuncias_ultimas_24h,
  (
    SELECT COUNT(*)::bigint
    FROM public.casos_notificados cn
    WHERE cn.cliente_id = u.cliente_id
      AND (cn.created_at)::date = CURRENT_DATE
      AND cn.deleted_at IS NULL
  ) AS casos_hoje
FROM public.usuarios u
WHERE u.auth_id = auth.uid();

GRANT SELECT ON public.v_central_operacional TO authenticated;

COMMENT ON VIEW public.v_central_operacional IS
  'KPIs do dia para a Central Operacional. Um row por usuário logado. security_invoker; subconsultas por métrica evitam produto cartesiano.';
