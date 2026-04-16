-- =============================================================================
-- HARDENING FINAL — 20270213000000
-- Corrige 4 falhas de segurança identificadas na auditoria:
--
-- C1. fn_iniciar_inspecao_foco — não validava papel; admin/supervisor podiam iniciar inspeção
-- C2. rpc_atribuir_agente_foco_lote — usava usuarios.papel_app (inexistente) → crash
-- C3. casos_notificados RLS — INSERT/UPDATE sem restrição de papel; agente podia criar casos
-- M1. piloto_eventos RLS — analista_regional sem cliente_id → removido da policy
-- =============================================================================

-- ── C1. fn_iniciar_inspecao_foco: somente agente ativo ───────────────────────

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
  v_papel      text;
  v_ativo      boolean;
BEGIN
  -- Obter papel e status ativo do chamador via papeis_usuarios (canônico)
  SELECT u.id, pu.papel, u.ativo
    INTO v_usuario_id, v_papel, v_ativo
    FROM usuarios u
    LEFT JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
   WHERE u.auth_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- NULL guard: usuário sem papel em papeis_usuarios
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário sem papel definido — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- Usuário inativo (JWT pode ficar válido por até 1h após desativação)
  IF NOT COALESCE(v_ativo, false) THEN
    RAISE EXCEPTION 'Usuário inativo — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- SOMENTE agente executa campo
  IF v_papel != 'agente' THEN
    RAISE EXCEPTION 'Apenas agentes podem iniciar inspeções. Papel atual: %', v_papel
      USING ERRCODE = 'P0001';
  END IF;

  -- Buscar o foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Verificar tenant
  IF NOT usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para acessar este foco' USING ERRCODE = 'P0003';
  END IF;

  -- Idempotente: já está em inspeção
  IF v_foco.status = 'em_inspecao' THEN
    RETURN jsonb_build_object('ok', true, 'ja_em_inspecao', true, 'foco_id', p_foco_id);
  END IF;

  -- Só aguarda_inspecao pode iniciar inspeção
  IF v_foco.status != 'aguarda_inspecao' THEN
    RAISE EXCEPTION 'Foco não pode iniciar inspeção no estado atual: %', v_foco.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Transicionar
  UPDATE focos_risco
  SET
    status         = 'em_inspecao',
    responsavel_id = COALESCE(responsavel_id, v_usuario_id),
    inspecao_em    = COALESCE(inspecao_em, now()),
    observacao     = COALESCE(NULLIF(p_observacao, ''), observacao),
    updated_at     = now()
  WHERE id = p_foco_id;

  RETURN jsonb_build_object('ok', true, 'ja_em_inspecao', false, 'foco_id', p_foco_id);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_iniciar_inspecao_foco(uuid, text) TO authenticated;

COMMENT ON FUNCTION fn_iniciar_inspecao_foco IS
  'Inicia inspeção de um foco. EXCLUSIVO para agentes ativos. '
  'Guards: papel NULL, ativo=false, papel != agente, estado != aguarda_inspecao.';

-- ── C2. rpc_atribuir_agente_foco_lote: migrar de papel_app para papeis_usuarios ─

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
  v_papel      text;
  v_ativo      boolean;
  v_foco       focos_risco%ROWTYPE;
  v_atribuidos int := 0;
  v_ignorados  int := 0;
  v_foco_id    uuid;
  v_novo_status text;
BEGIN
  -- Obter dados do chamador
  SELECT * INTO v_usuario FROM usuarios u WHERE u.auth_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;
  v_ativo := v_usuario.ativo;

  -- Obter papel canônico via papeis_usuarios (não usuarios.papel_app — removida)
  SELECT pu.papel INTO v_papel
    FROM papeis_usuarios pu
   WHERE pu.usuario_id = auth.uid();

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário sem papel definido — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_ativo, false) THEN
    RAISE EXCEPTION 'Usuário inativo — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- SOMENTE supervisor pode distribuir focos
  IF v_papel != 'supervisor' THEN
    RAISE EXCEPTION 'Apenas supervisores podem distribuir focos em lote. Papel atual: %', v_papel
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar agente destino: mesmo cliente, ativo, papel agente — via papeis_usuarios
  IF NOT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    JOIN focos_risco f ON f.id = p_foco_ids[1] AND f.cliente_id = u.cliente_id
    WHERE u.id = p_agente_id
      AND pu.papel = 'agente'
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Agente inválido ou inativo para este cliente' USING ERRCODE = 'P0005';
  END IF;

  FOREACH v_foco_id IN ARRAY p_foco_ids LOOP
    SELECT * INTO v_foco FROM focos_risco WHERE id = v_foco_id;

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
        v_foco_id, v_foco.cliente_id,
        'em_triagem', 'aguarda_inspecao',
        v_usuario.id, COALESCE(p_motivo, 'Atribuição em lote pelo supervisor')
      );
    ELSE
      UPDATE focos_risco
         SET responsavel_id = p_agente_id, updated_at = now()
       WHERE id = v_foco_id;

      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id, v_foco.cliente_id,
        'aguarda_inspecao', 'aguarda_inspecao',
        v_usuario.id, COALESCE(p_motivo, 'Reatribuição em lote pelo supervisor')
      );
    END IF;

    v_atribuidos := v_atribuidos + 1;
  END LOOP;

  RETURN jsonb_build_object('atribuidos', v_atribuidos, 'ignorados', v_ignorados);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atribuir_agente_foco_lote(uuid[], uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_atribuir_agente_foco_lote IS
  'Distribui múltiplos focos a um agente. Exclusivo para supervisores ativos. '
  'Papel verificado via papeis_usuarios.papel (papel_app removida). '
  'Guards: NULL papel, ativo=false, papel != supervisor, agente inválido.';

-- ── C3. casos_notificados RLS: restringir INSERT/UPDATE por papel ─────────────

DROP POLICY IF EXISTS "casos_notificados_insert" ON public.casos_notificados;
DROP POLICY IF EXISTS "casos_notificados_update" ON public.casos_notificados;

-- INSERT: apenas notificador, supervisor ou admin
CREATE POLICY "casos_notificados_insert" ON public.casos_notificados
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM papeis_usuarios pu
       WHERE pu.usuario_id = auth.uid()
         AND pu.papel IN ('notificador', 'supervisor', 'admin')
    )
  );

-- UPDATE: apenas supervisor ou admin (notificador só registra, não edita)
CREATE POLICY "casos_notificados_update" ON public.casos_notificados
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM papeis_usuarios pu
       WHERE pu.usuario_id = auth.uid()
         AND pu.papel IN ('supervisor', 'admin')
    )
  );

-- ── M1. piloto_eventos RLS: remover analista_regional (sem cliente_id proprio) ─

DROP POLICY IF EXISTS "piloto_eventos_insert" ON public.piloto_eventos;

CREATE POLICY "piloto_eventos_insert" ON public.piloto_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM papeis_usuarios pu
       WHERE pu.usuario_id = auth.uid()
         AND pu.papel IN ('admin', 'supervisor', 'agente', 'notificador')
    )
  );

-- ── Validação pós-aplicação ───────────────────────────────────────────────────
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'casos_notificados'
    AND cmd IN ('INSERT', 'UPDATE');
  ASSERT v_count = 2,
    'FALHA: esperado 2 políticas de escrita em casos_notificados, encontrado ' || v_count;

  RAISE NOTICE '20270213000000 — hardening_final OK: % políticas de escrita em casos_notificados.', v_count;
END $$;
