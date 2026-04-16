-- =============================================================================
-- 20270202000000 — Corrigir RPCs com papéis legado
--
-- BUGS CORRIGIDOS:
--
-- A) rpc_atribuir_agente_foco (20270101000000)
--    - CHECK usava 'gestor' (morto) e permitia 'admin' (proibido pela regra de negócio)
--    - Regra: SOMENTE supervisor pode atribuir agente a foco
--    - admin NÃO participa da operação municipal
--
-- B) rpc_atribuir_agente_foco_lote (20270102000000)
--    - Mesmo bug: 'admin'/'gestor' → somente 'supervisor'
--
-- C) rpc_transicionar_foco_risco (20270101000002)
--    - Guard 1: IN ('admin', 'gestor') — 'supervisor' não era capturado corretamente;
--              mensagem dizia "Supervisores" mas era ativada por 'admin'/'gestor'
--    - Guard 2: NOT IN ('operador', 'agente') — 'operador' é papel morto
--    - Correção: bloqueio explícito de 'admin' e 'supervisor'; agente como único autorizado
-- =============================================================================

-- ── A. rpc_atribuir_agente_foco — somente supervisor ─────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_atribuir_agente_foco(
  p_foco_id   uuid,
  p_agente_id uuid,
  p_motivo    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario   usuarios%ROWTYPE;
  v_foco      focos_risco%ROWTYPE;
  v_novo_status text;
BEGIN
  -- Validar papel do chamador: SOMENTE supervisor
  SELECT * INTO v_usuario FROM usuarios WHERE auth_id = auth.uid();
  IF NOT FOUND OR v_usuario.papel_app != 'supervisor' THEN
    RAISE EXCEPTION 'Apenas supervisores podem distribuir focos para agentes'
      USING ERRCODE = 'P0001';
  END IF;

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id USING ERRCODE = 'P0002';
  END IF;

  -- Validar acesso de tenant
  IF NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco' USING ERRCODE = 'P0003';
  END IF;

  -- Só permite distribuição nos estados corretos
  IF v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao') THEN
    RAISE EXCEPTION 'Distribuição só é permitida nos estados em_triagem ou aguarda_inspecao. Estado atual: %',
      v_foco.status USING ERRCODE = 'P0004';
  END IF;

  -- Validar que o agente alvo pertence ao mesmo cliente
  IF NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = p_agente_id
      AND cliente_id = v_foco.cliente_id
      AND papel_app = 'agente'
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Agente inválido ou inativo para este cliente'
      USING ERRCODE = 'P0005';
  END IF;

  IF v_foco.status = 'em_triagem' THEN
    -- Primeira atribuição: avança para aguarda_inspecao
    v_novo_status := 'aguarda_inspecao';
    UPDATE focos_risco
       SET status         = v_novo_status,
           responsavel_id = p_agente_id,
           updated_at     = now()
     WHERE id = p_foco_id;

    INSERT INTO foco_risco_historico (
      foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      p_foco_id,
      v_foco.cliente_id,
      'em_triagem',
      'aguarda_inspecao',
      v_usuario.id,
      COALESCE(p_motivo, 'Atribuição de agente pelo supervisor')
    );
  ELSE
    -- Reatribuição: já está em aguarda_inspecao, apenas muda responsável
    UPDATE focos_risco
       SET responsavel_id = p_agente_id,
           updated_at     = now()
     WHERE id = p_foco_id;

    INSERT INTO foco_risco_historico (
      foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      p_foco_id,
      v_foco.cliente_id,
      'aguarda_inspecao',
      'aguarda_inspecao',
      v_usuario.id,
      COALESCE(p_motivo, 'Reatribuição de agente pelo supervisor')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atribuir_agente_foco(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_atribuir_agente_foco IS
  'Distribui um foco para um agente. Exclusivo para supervisores — admin NÃO pode atribuir. '
  'em_triagem → aguarda_inspecao (primeira atribuição). '
  'aguarda_inspecao → aguarda_inspecao (reatribuição — só muda responsável). '
  'Valida que o agente pertence ao mesmo cliente e está ativo.';

-- ── B. rpc_atribuir_agente_foco_lote — somente supervisor ────────────────────

CREATE OR REPLACE FUNCTION public.rpc_atribuir_agente_foco_lote(
  p_foco_ids  uuid[],
  p_agente_id uuid,
  p_motivo    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario    usuarios%ROWTYPE;
  v_foco       focos_risco%ROWTYPE;
  v_atribuidos int := 0;
  v_ignorados  int := 0;
  v_foco_id    uuid;
  v_novo_status text;
BEGIN
  -- Validar papel do chamador: SOMENTE supervisor
  SELECT * INTO v_usuario FROM usuarios WHERE auth_id = auth.uid();
  IF NOT FOUND OR v_usuario.papel_app != 'supervisor' THEN
    RAISE EXCEPTION 'Apenas supervisores podem distribuir focos em lote'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar que o agente alvo pertence ao mesmo cliente e está ativo
  -- (usa o primeiro foco para derivar o cliente — todos devem ser do mesmo tenant)
  IF NOT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN focos_risco f ON f.id = p_foco_ids[1] AND f.cliente_id = u.cliente_id
    WHERE u.id = p_agente_id
      AND u.papel_app = 'agente'
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Agente inválido ou inativo para este cliente'
      USING ERRCODE = 'P0005';
  END IF;

  -- Iterar sobre cada foco elegível
  FOREACH v_foco_id IN ARRAY p_foco_ids LOOP
    SELECT * INTO v_foco FROM focos_risco WHERE id = v_foco_id;

    -- Ignorar focos não encontrados, de outro tenant ou em estado inelegível
    IF NOT FOUND
       OR NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id)
       OR v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao')
    THEN
      v_ignorados := v_ignorados + 1;
      CONTINUE;
    END IF;

    IF v_foco.status = 'em_triagem' THEN
      v_novo_status := 'aguarda_inspecao';
      UPDATE focos_risco
         SET status         = v_novo_status,
             responsavel_id = p_agente_id,
             updated_at     = now()
       WHERE id = v_foco_id;

      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id,
        v_foco.cliente_id,
        'em_triagem',
        'aguarda_inspecao',
        v_usuario.id,
        COALESCE(p_motivo, 'Atribuição em lote pelo supervisor')
      );
    ELSE
      -- Reatribuição (aguarda_inspecao → aguarda_inspecao)
      UPDATE focos_risco
         SET responsavel_id = p_agente_id,
             updated_at     = now()
       WHERE id = v_foco_id;

      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id,
        v_foco.cliente_id,
        'aguarda_inspecao',
        'aguarda_inspecao',
        v_usuario.id,
        COALESCE(p_motivo, 'Reatribuição em lote pelo supervisor')
      );
    END IF;

    v_atribuidos := v_atribuidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'atribuidos', v_atribuidos,
    'ignorados',  v_ignorados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atribuir_agente_foco_lote(uuid[], uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_atribuir_agente_foco_lote IS
  'Distribui múltiplos focos elegíveis (em_triagem ou aguarda_inspecao) a um agente. '
  'Exclusivo para supervisores — admin NÃO pode distribuir focos. '
  'Ignora focos em estados inelegíveis sem lançar erro (retorna contadores).';

-- ── C. rpc_transicionar_foco_risco — guards corrigidos ───────────────────────

CREATE OR REPLACE FUNCTION public.rpc_transicionar_foco_risco(
  p_foco_id        uuid,
  p_status_novo    text,
  p_motivo         text    DEFAULT NULL,
  p_responsavel_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco   focos_risco;
  v_papel  text;
BEGIN
  -- Obter papel do chamador
  SELECT papel_app INTO v_papel FROM usuarios WHERE auth_id = auth.uid();

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id;
  END IF;

  -- Validar acesso de tenant
  IF NOT usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco %', p_foco_id;
  END IF;

  -- Admin e supervisor NÃO executam transições de campo.
  -- Supervisor usa rpc_atribuir_agente_foco para distribuição.
  -- Admin não participa da operação municipal.
  IF v_papel IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION
      'Papel % não executa transições de campo. '
      'Supervisores usam rpc_atribuir_agente_foco para distribuição.',
      COALESCE(v_papel, 'desconhecido')
      USING ERRCODE = 'P0001';
  END IF;

  -- Apenas agentes executam transições operacionais
  IF v_papel != 'agente' THEN
    RAISE EXCEPTION 'Papel % não autorizado a transicionar focos',
      COALESCE(v_papel, 'desconhecido') USING ERRCODE = 'P0001';
  END IF;

  IF v_foco.status NOT IN ('aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento') THEN
    RAISE EXCEPTION
      'Agente só pode transicionar focos em estados operacionais. '
      'Estado atual: %. Aguarde distribuição do supervisor.',
      v_foco.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Executa transição (trigger fn_validar_transicao_foco_risco valida state machine e registra histórico)
  UPDATE focos_risco
     SET status         = p_status_novo,
         desfecho       = COALESCE(p_motivo, desfecho),
         responsavel_id = COALESCE(p_responsavel_id, responsavel_id)
   WHERE id = p_foco_id
  RETURNING * INTO v_foco;

  RETURN jsonb_build_object(
    'id',            v_foco.id,
    'status',        v_foco.status,
    'confirmado_em', v_foco.confirmado_em,
    'resolvido_em',  v_foco.resolvido_em,
    'updated_at',    v_foco.updated_at
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_transicionar_foco_risco IS
  'Transiciona o estado de um foco_risco. Exclusivo para agentes. '
  'Admin e supervisor NÃO têm acesso — supervisor usa rpc_atribuir_agente_foco. '
  'Estados operacionais permitidos: aguarda_inspecao, em_inspecao, confirmado, em_tratamento.';
