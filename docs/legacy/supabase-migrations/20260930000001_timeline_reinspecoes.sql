-- migration: 20260930000001_timeline_reinspecoes
-- Adiciona eventos de reinspecoes_programadas à v_foco_risco_timeline.
-- Recria a view completa com CREATE OR REPLACE para preservar grants.

CREATE OR REPLACE VIEW v_foco_risco_timeline
WITH (security_invoker = true)
AS
-- 1. Transições de estado (foco_risco_historico)
SELECT
  frh.foco_risco_id,
  'estado'                                                           AS tipo,
  frh.alterado_em                                                    AS ts,
  'Status: ' || COALESCE(frh.status_anterior, 'novo') || ' → ' || frh.status_novo AS titulo,
  frh.motivo                                                         AS descricao,
  frh.alterado_por                                                   AS ator_id,
  NULL::uuid                                                         AS ref_id
FROM foco_risco_historico frh

UNION ALL

-- 2. Vistorias vinculadas (via origem_vistoria_id)
SELECT
  fr.id                                                              AS foco_risco_id,
  'vistoria'                                                         AS tipo,
  v.checkin_em                                                       AS ts,
  'Vistoria: ' || v.tipo_atividade                                   AS titulo,
  CASE
    WHEN v.acesso_realizado = false THEN 'Sem acesso — ' || COALESCE(v.motivo_sem_acesso, '')
    ELSE v.observacao
  END                                                                AS descricao,
  v.agente_id                                                        AS ator_id,
  v.id                                                               AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.id = fr.origem_vistoria_id

UNION ALL

-- 3. Vistorias no mesmo imóvel/ciclo (sem vínculo direto)
SELECT
  fr.id                                                              AS foco_risco_id,
  'vistoria_campo'                                                   AS tipo,
  v.checkin_em                                                       AS ts,
  'Vistoria de campo: ' || v.tipo_atividade                          AS titulo,
  v.observacao                                                       AS descricao,
  v.agente_id                                                        AS ator_id,
  v.id                                                               AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.imovel_id = fr.imovel_id
 AND v.ciclo     = fr.ciclo
 AND v.id       <> COALESCE(fr.origem_vistoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE fr.imovel_id IS NOT NULL
  AND fr.ciclo     IS NOT NULL

UNION ALL

-- 4. Mudanças de SLA (abertura / vencimento / conclusão)
SELECT
  fr.id                                                              AS foco_risco_id,
  'sla'                                                              AS tipo,
  COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio)           AS ts,
  CASE sla.status
    WHEN 'aberto'    THEN 'SLA aberto — prazo: ' || to_char(sla.prazo_final, 'DD/MM/YYYY HH24:MI')
    WHEN 'vencido'   THEN 'SLA vencido'
    WHEN 'concluido' THEN 'SLA concluído'
    ELSE 'SLA: ' || sla.status
  END                                                                AS titulo,
  'Prioridade ' || sla.prioridade || ' — ' || sla.sla_horas::text || 'h' AS descricao,
  NULL::uuid                                                         AS ator_id,
  sla.id                                                             AS ref_id
FROM focos_risco fr
JOIN sla_operacional sla ON sla.foco_risco_id = fr.id

UNION ALL

-- 5. Casos notificados cruzados (via casos_ids array)
SELECT
  fr.id                                                              AS foco_risco_id,
  'caso_notificado'                                                  AS tipo,
  cn.data_notificacao::timestamptz                                   AS ts,
  'Caso notificado: ' || cn.doenca                                   AS titulo,
  'Status: ' || cn.status || ' — ' || COALESCE(cn.bairro, '')        AS descricao,
  cn.notificador_id                                                  AS ator_id,
  cn.id                                                              AS ref_id
FROM focos_risco fr
JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
WHERE array_length(fr.casos_ids, 1) > 0

UNION ALL

-- 6. Reinspeções programadas
SELECT
  r.foco_risco_id,
  'reinspecao'                                                       AS tipo,
  COALESCE(r.data_realizada, r.updated_at)                          AS ts,
  CASE r.status
    WHEN 'pendente'   THEN 'Reinspeção pendente'
    WHEN 'vencida'    THEN 'Reinspeção vencida'
    WHEN 'realizada'  THEN 'Reinspeção realizada'
    WHEN 'cancelada'  THEN 'Reinspeção cancelada'
    ELSE 'Reinspeção'
  END                                                                AS titulo,
  CASE
    WHEN r.resultado IS NOT NULL THEN
      'Resultado: ' || CASE r.resultado
        WHEN 'resolvido'     THEN 'Problema resolvido'
        WHEN 'persiste'      THEN 'Problema persiste'
        WHEN 'nao_realizado' THEN 'Não foi possível realizar'
        ELSE r.resultado::text
      END ||
      CASE WHEN r.observacao IS NOT NULL THEN ' — ' || r.observacao ELSE '' END
    WHEN r.status IN ('pendente', 'vencida') THEN
      'Prevista para ' || to_char(r.data_prevista, 'DD/MM/YYYY HH24:MI')
    WHEN r.status = 'cancelada' THEN
      COALESCE(r.motivo_cancelamento, 'Cancelada')
    ELSE NULL
  END                                                                AS descricao,
  r.responsavel_id                                                   AS ator_id,
  r.id                                                               AS ref_id
FROM reinspecoes_programadas r;

COMMENT ON VIEW v_foco_risco_timeline IS
  'Linha do tempo unificada de tudo que aconteceu em um foco: '
  'transições de estado, vistorias, SLA, casos notificados cruzados e reinspeções. '
  'Ordenar por ts DESC no cliente. security_invoker = true.';
