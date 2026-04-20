-- migration: 20261001000000_classificacao_inicial
-- GAP P1 — Classificação inicial explícita de focos_risco.
--
-- STATUS  = etapa do fluxo operacional  (suspeita → em_triagem → ... → resolvido)
-- CLASSIFICACAO_INICIAL = natureza/origem do item (suspeito | risco | foco | caso_notificado)
--
-- São dimensões ortogonais: um foco pode ser "suspeito" (status) com classificação "foco"
-- se o drone detectou algo mas ainda não foi confirmado em campo.

-- ── 1. Coluna classificacao_inicial em focos_risco ─────────────────────────────

ALTER TABLE focos_risco
  ADD COLUMN IF NOT EXISTS classificacao_inicial text NOT NULL DEFAULT 'suspeito'
    CHECK (classificacao_inicial IN ('suspeito', 'risco', 'foco', 'caso_notificado'));

-- ── 2. Backfill baseado em origem_tipo ────────────────────────────────────────
-- Regras de negócio:
--   drone  → 'foco'    (evidência técnica de criadouro)
--   pluvio → 'risco'   (situação de risco ambiental)
--   cidadao / agente / manual → 'suspeito' (denúncia ou evidência não verificada)

UPDATE focos_risco
   SET classificacao_inicial = CASE origem_tipo
     WHEN 'drone'  THEN 'foco'
     WHEN 'pluvio' THEN 'risco'
     ELSE 'suspeito'
   END;

-- ── 3. Índice composto para triagem ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_focos_classificacao
  ON focos_risco (cliente_id, classificacao_inicial, status);

-- ── 4. Trigger BEFORE INSERT: auto-classificar focos novos por origem ─────────

CREATE OR REPLACE FUNCTION fn_auto_classificar_foco()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Drone e pluvio sempre são promovidos à classificação técnica,
  -- independente do valor default ou valor explicitamente passado.
  NEW.classificacao_inicial := CASE NEW.origem_tipo
    WHEN 'drone'  THEN 'foco'
    WHEN 'pluvio' THEN 'risco'
    ELSE NEW.classificacao_inicial   -- preserva valor explícito ou DEFAULT 'suspeito'
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_classificar_foco
  BEFORE INSERT ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_classificar_foco();

-- ── 5. Extender foco_risco_historico para eventos de classificação ─────────────
-- Adicionamos tipo_evento para distinguir transições de status de alterações de classificação.

ALTER TABLE foco_risco_historico
  ADD COLUMN IF NOT EXISTS tipo_evento text NOT NULL DEFAULT 'transicao_status'
    CHECK (tipo_evento IN ('transicao_status', 'classificacao_alterada')),
  ADD COLUMN IF NOT EXISTS classificacao_anterior text,
  ADD COLUMN IF NOT EXISTS classificacao_nova     text;

-- Permite NULL em status_novo para eventos de classificação (não houve mudança de status)
ALTER TABLE foco_risco_historico
  ALTER COLUMN status_novo DROP NOT NULL;

-- ── 6. RPC rpc_atualizar_classificacao_inicial ────────────────────────────────
-- Única forma de alterar a classificação: valida tenant, registra no histórico.

CREATE OR REPLACE FUNCTION rpc_atualizar_classificacao_inicial(
  p_foco_id       uuid,
  p_classificacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco    focos_risco%ROWTYPE;
  v_usuario uuid;
BEGIN
  -- Validação de valor aceito
  IF p_classificacao NOT IN ('suspeito', 'risco', 'foco', 'caso_notificado') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Classificação inválida. Aceitos: suspeito, risco, foco, caso_notificado.');
  END IF;

  -- Busca o foco (com soft-delete)
  SELECT * INTO v_foco
    FROM focos_risco
   WHERE id = p_foco_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Foco não encontrado.');
  END IF;

  -- Isolamento de tenant
  IF NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso não autorizado.');
  END IF;

  -- Sem mudança real
  IF v_foco.classificacao_inicial = p_classificacao THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  -- Identifica o usuário corrente
  SELECT id INTO v_usuario
    FROM usuarios
   WHERE auth_id = auth.uid()
   LIMIT 1;

  -- Atualiza o foco
  UPDATE focos_risco
     SET classificacao_inicial = p_classificacao,
         updated_at            = now()
   WHERE id = p_foco_id;

  -- Registra no histórico (tipo_evento = 'classificacao_alterada')
  INSERT INTO foco_risco_historico (
    foco_risco_id, cliente_id,
    tipo_evento,
    classificacao_anterior, classificacao_nova,
    alterado_por, alterado_em
  ) VALUES (
    p_foco_id, v_foco.cliente_id,
    'classificacao_alterada',
    v_foco.classificacao_inicial, p_classificacao,
    v_usuario, now()
  );

  RETURN jsonb_build_object(
    'ok',      true,
    'changed', true,
    'de',      v_foco.classificacao_inicial,
    'para',    p_classificacao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_atualizar_classificacao_inicial(uuid, text) TO authenticated;

-- ── 7. Atualizar v_foco_risco_timeline ────────────────────────────────────────
-- Consolida todas as branches anteriores + nova branch 'classificacao_alterada'.
-- Filtra a branch 'estado' para somente tipo_evento = 'transicao_status'.

CREATE OR REPLACE VIEW v_foco_risco_timeline
WITH (security_invoker = true)
AS
-- 1. Transições de estado (exclui eventos de classificação)
SELECT
  frh.foco_risco_id,
  'estado'                                                               AS tipo,
  frh.alterado_em                                                        AS ts,
  'Status: ' || COALESCE(frh.status_anterior, 'novo')
    || ' → ' || COALESCE(frh.status_novo, '?')                           AS titulo,
  frh.motivo                                                             AS descricao,
  frh.alterado_por                                                       AS ator_id,
  NULL::uuid                                                             AS ref_id
FROM foco_risco_historico frh
WHERE COALESCE(frh.tipo_evento, 'transicao_status') = 'transicao_status'

UNION ALL

-- 2. Alterações de classificação inicial
SELECT
  frh.foco_risco_id,
  'classificacao_alterada'                                               AS tipo,
  frh.alterado_em                                                        AS ts,
  'Classificação: '
    || COALESCE(frh.classificacao_anterior, '—')
    || ' → '
    || COALESCE(frh.classificacao_nova, '?')                             AS titulo,
  NULL::text                                                             AS descricao,
  frh.alterado_por                                                       AS ator_id,
  NULL::uuid                                                             AS ref_id
FROM foco_risco_historico frh
WHERE frh.tipo_evento = 'classificacao_alterada'

UNION ALL

-- 3. Vistorias vinculadas (via origem_vistoria_id)
SELECT
  fr.id                                                                  AS foco_risco_id,
  'vistoria'                                                             AS tipo,
  v.checkin_em                                                           AS ts,
  'Vistoria: ' || v.tipo_atividade                                       AS titulo,
  CASE
    WHEN v.acesso_realizado = false
    THEN 'Sem acesso — ' || COALESCE(v.motivo_sem_acesso, '')
    ELSE v.observacao
  END                                                                    AS descricao,
  v.agente_id                                                            AS ator_id,
  v.id                                                                   AS ref_id
FROM focos_risco fr
JOIN vistorias v ON v.id = fr.origem_vistoria_id

UNION ALL

-- 4. Vistorias no mesmo imóvel/ciclo (sem vínculo direto)
SELECT
  fr.id                                                                  AS foco_risco_id,
  'vistoria_campo'                                                       AS tipo,
  v.checkin_em                                                           AS ts,
  'Vistoria de campo: ' || v.tipo_atividade                              AS titulo,
  v.observacao                                                           AS descricao,
  v.agente_id                                                            AS ator_id,
  v.id                                                                   AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON  v.imovel_id = fr.imovel_id
 AND  v.ciclo     = fr.ciclo
 AND  v.id       <> COALESCE(fr.origem_vistoria_id,
                              '00000000-0000-0000-0000-000000000000'::uuid)
WHERE fr.imovel_id IS NOT NULL
  AND fr.ciclo     IS NOT NULL

UNION ALL

-- 5. Mudanças de SLA
SELECT
  fr.id                                                                  AS foco_risco_id,
  'sla'                                                                  AS tipo,
  COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio)               AS ts,
  CASE sla.status
    WHEN 'aberto'    THEN 'SLA aberto — prazo: '
                          || to_char(sla.prazo_final, 'DD/MM/YYYY HH24:MI')
    WHEN 'vencido'   THEN 'SLA vencido'
    WHEN 'concluido' THEN 'SLA concluído'
    ELSE 'SLA: ' || sla.status
  END                                                                    AS titulo,
  'Prioridade ' || sla.prioridade
    || ' — ' || sla.sla_horas::text || 'h'                               AS descricao,
  NULL::uuid                                                             AS ator_id,
  sla.id                                                                 AS ref_id
FROM focos_risco fr
JOIN sla_operacional sla ON sla.foco_risco_id = fr.id

UNION ALL

-- 6. Casos notificados cruzados (via casos_ids array)
SELECT
  fr.id                                                                  AS foco_risco_id,
  'caso_notificado'                                                      AS tipo,
  cn.data_notificacao::timestamptz                                       AS ts,
  'Caso notificado: ' || cn.doenca                                       AS titulo,
  'Status: ' || cn.status || ' — ' || COALESCE(cn.bairro, '')            AS descricao,
  cn.notificador_id                                                      AS ator_id,
  cn.id                                                                  AS ref_id
FROM focos_risco fr
JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
WHERE array_length(fr.casos_ids, 1) > 0

UNION ALL

-- 7. Reinspeções programadas
SELECT
  r.foco_risco_id,
  'reinspecao'                                                           AS tipo,
  COALESCE(r.data_realizada, r.updated_at)                              AS ts,
  CASE r.status
    WHEN 'pendente'  THEN 'Reinspeção pendente'
    WHEN 'vencida'   THEN 'Reinspeção vencida'
    WHEN 'realizada' THEN 'Reinspeção realizada'
    WHEN 'cancelada' THEN 'Reinspeção cancelada'
    ELSE 'Reinspeção'
  END                                                                    AS titulo,
  CASE
    WHEN r.resultado IS NOT NULL THEN
      'Resultado: ' || CASE r.resultado
        WHEN 'resolvido'     THEN 'Problema resolvido'
        WHEN 'persiste'      THEN 'Problema persiste'
        WHEN 'nao_realizado' THEN 'Não foi possível realizar'
        ELSE r.resultado::text
      END
      || CASE WHEN r.observacao IS NOT NULL THEN ' — ' || r.observacao ELSE '' END
    WHEN r.status IN ('pendente', 'vencida') THEN
      'Prevista para ' || to_char(r.data_prevista, 'DD/MM/YYYY HH24:MI')
    WHEN r.status = 'cancelada' THEN
      COALESCE(r.motivo_cancelamento, 'Cancelada')
    ELSE NULL
  END                                                                    AS descricao,
  r.responsavel_id                                                       AS ator_id,
  r.id                                                                   AS ref_id
FROM reinspecoes_programadas r;

COMMENT ON VIEW v_foco_risco_timeline IS
  'Linha do tempo unificada: estado, classificacao_alterada, vistorias, '
  'SLA, casos notificados e reinspeções. '
  'Ordenar por ts DESC no cliente. security_invoker = true.';
