-- 20261005000000_em_inspecao_fechamento.sql
-- Fecha o fluxo operacional oficial do estado em_inspecao para o piloto.
--
-- Alterações:
-- 1. Extend CHECK tipo_evento com 'inspecao_iniciada'
-- 2. fn_registrar_historico_foco usa tipo_evento semântico para em_inspecao
-- 3. RPC fn_iniciar_inspecao_foco — ação explícita e idempotente do agente
-- 4. Trigger de vistoria permanece como fallback silencioso

-- ── 1. Extend CHECK tipo_evento ───────────────────────────────────────────────

DO $$
BEGIN
  ALTER TABLE foco_risco_historico
    DROP CONSTRAINT IF EXISTS foco_risco_historico_tipo_evento_check;

  ALTER TABLE foco_risco_historico
    ADD CONSTRAINT foco_risco_historico_tipo_evento_check
    CHECK (tipo_evento IN (
      'transicao_status',
      'classificacao_alterada',
      'dados_minimos_completos',
      'inspecao_iniciada'
    ));
END $$;

-- ── 2. fn_registrar_historico_foco: tipo_evento semântico ─────────────────────
-- Usa 'inspecao_iniciada' quando a transição entra em em_inspecao.
-- Mantém 'transicao_status' para todos os outros casos.

CREATE OR REPLACE FUNCTION fn_registrar_historico_foco()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text;
BEGIN
  v_tipo := CASE
    WHEN NEW.status = 'em_inspecao' AND OLD.status != 'em_inspecao' THEN 'inspecao_iniciada'
    ELSE 'transicao_status'
  END;

  INSERT INTO foco_risco_historico (
    foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, tipo_evento
  ) VALUES (
    NEW.id, NEW.cliente_id, OLD.status, NEW.status, NEW.responsavel_id, v_tipo
  );
  RETURN NEW;
END;
$$;

-- ── 3. RPC fn_iniciar_inspecao_foco ──────────────────────────────────────────
-- Ação explícita do agente para iniciar inspeção.
-- Idempotente: se já em_inspecao, retorna sucesso sem alterar dados.

CREATE OR REPLACE FUNCTION fn_iniciar_inspecao_foco(
  p_foco_id    uuid,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco       focos_risco%ROWTYPE;
  v_usuario_id uuid;
BEGIN
  -- Resolver usuario_id a partir de auth.uid()
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- Buscar o foco
  SELECT * INTO v_foco
  FROM focos_risco
  WHERE id = p_foco_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Verificar permissão via função canônica
  IF NOT usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para acessar este foco' USING ERRCODE = 'P0003';
  END IF;

  -- Idempotente: já está em inspeção
  IF v_foco.status = 'em_inspecao' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ja_em_inspecao', true,
      'foco_id', p_foco_id
    );
  END IF;

  -- Validar estado: só aguarda_inspecao pode iniciar
  IF v_foco.status != 'aguarda_inspecao' THEN
    RAISE EXCEPTION 'Foco não pode iniciar inspeção no estado atual: %', v_foco.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Transicionar — dispara fn_validar_transicao_foco_risco e fn_registrar_historico_foco
  UPDATE focos_risco
  SET
    status         = 'em_inspecao',
    responsavel_id = COALESCE(responsavel_id, v_usuario_id),
    inspecao_em    = COALESCE(inspecao_em, now()),
    observacao     = COALESCE(NULLIF(p_observacao, ''), observacao),
    updated_at     = now()
  WHERE id = p_foco_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ja_em_inspecao', false,
    'foco_id', p_foco_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_iniciar_inspecao_foco(uuid, text) TO authenticated;

-- ── 4. Trigger fallback de vistoria: já é idempotente ─────────────────────────
-- fn_auto_em_inspecao_por_vistoria só age quando status = 'aguarda_inspecao'.
-- Se já for 'em_inspecao' (via RPC acima), não faz nada. Sem alteração necessária.
