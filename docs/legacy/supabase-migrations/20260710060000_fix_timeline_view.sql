-- Fix: substituir caracteres UTF-8 multi-byte (em-dash) por ASCII nas string literals
-- Reescreve v_foco_risco_timeline com apenas ASCII nas string literals

CREATE OR REPLACE VIEW v_foco_risco_timeline
WITH (security_invoker = true)
AS
-- 1. Transições de estado
SELECT
  frh.foco_risco_id,
  'estado'::text AS tipo,
  frh.alterado_em AS ts,
  'Status: ' || COALESCE(frh.status_anterior, 'novo') || ' -> ' || frh.status_novo AS titulo,
  frh.motivo AS descricao,
  frh.alterado_por AS ator_id,
  NULL::uuid AS ref_id
FROM foco_risco_historico frh

UNION ALL

-- 2. Detecção de origem (levantamento_item)
SELECT
  fr.id AS foco_risco_id,
  'deteccao'::text AS tipo,
  li.data_hora::timestamptz AS ts,
  'Deteccao: ' || COALESCE(li.item, '-')
    || ' (' || COALESCE(li.risco, '-')
    || ' - score ' || COALESCE(li.score_final::text, 'N/A') || ')' AS titulo,
  COALESCE(li.endereco_curto, li.endereco_completo) AS descricao,
  NULL::uuid AS ator_id,
  li.id AS ref_id
FROM focos_risco fr
JOIN levantamento_itens li ON li.id = fr.origem_levantamento_item_id

UNION ALL

-- 3. Vistorias vinculadas diretamente (origem_vistoria_id)
SELECT
  fr.id AS foco_risco_id,
  'vistoria'::text AS tipo,
  v.checkin_em AS ts,
  'Vistoria: ' || v.tipo_atividade AS titulo,
  CASE
    WHEN v.acesso_realizado = false
      THEN 'Sem acesso - ' || COALESCE(v.motivo_sem_acesso::text, '')
    ELSE COALESCE(v.observacao, 'Acesso realizado')
  END AS descricao,
  v.agente_id AS ator_id,
  v.id AS ref_id
FROM focos_risco fr
JOIN vistorias v ON v.id = fr.origem_vistoria_id

UNION ALL

-- 4. Vistorias no mesmo imovel/ciclo (sem vinculo direto)
SELECT
  fr.id AS foco_risco_id,
  'vistoria_campo'::text AS tipo,
  v.checkin_em AS ts,
  'Vistoria de campo: ' || v.tipo_atividade AS titulo,
  COALESCE(v.observacao, 'Vistoria registrada') AS descricao,
  v.agente_id AS ator_id,
  v.id AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.imovel_id = fr.imovel_id
 AND v.ciclo = fr.ciclo
 AND v.id <> COALESCE(fr.origem_vistoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE fr.imovel_id IS NOT NULL
  AND fr.ciclo IS NOT NULL

UNION ALL

-- 5. Acoes executadas (operacoes via foco_risco_id)
SELECT
  op.foco_risco_id AS foco_risco_id,
  'acao'::text AS tipo,
  op.iniciado_em AS ts,
  'Acao executada' AS titulo,
  COALESCE(op.observacao, 'Operacao registrada') AS descricao,
  op.responsavel_id AS ator_id,
  op.id AS ref_id
FROM operacoes op
WHERE op.foco_risco_id IS NOT NULL

UNION ALL

-- 6. Eventos de SLA
SELECT
  fr.id AS foco_risco_id,
  'sla'::text AS tipo,
  COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio) AS ts,
  CASE sla.status
    WHEN 'aberto'    THEN 'SLA aberto - prazo: ' || to_char(sla.prazo_final, 'DD/MM/YYYY HH24:MI')
    WHEN 'vencido'   THEN 'SLA vencido'
    WHEN 'concluido' THEN 'SLA concluido'
    ELSE 'SLA: ' || sla.status
  END AS titulo,
  'Prioridade ' || sla.prioridade || ' - ' || sla.sla_horas::text || 'h' AS descricao,
  NULL::uuid AS ator_id,
  sla.id AS ref_id
FROM focos_risco fr
JOIN sla_operacional sla ON sla.foco_risco_id = fr.id

UNION ALL

-- 7. Casos notificados cruzados
SELECT
  fr.id AS foco_risco_id,
  'caso_notificado'::text AS tipo,
  cn.data_notificacao::timestamptz AS ts,
  'Caso notificado: ' || cn.doenca AS titulo,
  'Status: ' || cn.status || ' - ' || COALESCE(cn.bairro, '') AS descricao,
  cn.notificador_id AS ator_id,
  cn.id AS ref_id
FROM focos_risco fr
JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
WHERE array_length(fr.casos_ids, 1) > 0;

COMMENT ON VIEW v_foco_risco_timeline IS
  'Linha do tempo unificada: deteccao, estado, vistoria, vistoria_campo, acao, sla, caso_notificado. '
  'Ordenar por ts DESC no cliente. security_invoker = true.';
