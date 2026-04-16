-- =============================================================================
-- 20270202000004 — Migrar rpc_atribuir_agente_foco de usuarios.papel_app
--                  para papeis_usuarios.papel
--
-- PROBLEMA:
--   usuarios.papel_app não existe (removida em migration anterior).
--   rpc_atribuir_agente_foco usava essa coluna em dois pontos:
--     1. v_usuario.papel_app != 'supervisor'   → guard do chamador
--     2. AND papel_app = 'agente'              → validação do agente alvo
--   Ambos falhavam em runtime com column not found.
--
-- CORREÇÃO:
--   1. Obter papel do chamador via JOIN em papeis_usuarios
--   2. Validar papel do agente alvo via EXISTS em papeis_usuarios
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_atribuir_agente_foco(
  p_foco_id  uuid,
  p_agente_id uuid,
  p_motivo   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario    usuarios%ROWTYPE;
  v_papel      text;
  v_foco       focos_risco%ROWTYPE;
  v_novo_status text;
BEGIN
  -- Obter dados do chamador
  SELECT u.* INTO v_usuario FROM usuarios u WHERE u.auth_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- Obter papel canônico do chamador (papeis_usuarios, não usuarios.papel_app)
  SELECT pu.papel INTO v_papel
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid();

  -- Validar papel do chamador: SOMENTE supervisor
  IF v_papel IS NULL OR v_papel != 'supervisor' THEN
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

  -- Validar que o agente alvo pertence ao mesmo cliente, está ativo e tem papel agente
  -- papel verificado via papeis_usuarios, não usuarios.papel_app
  IF NOT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    WHERE u.id = p_agente_id
      AND u.cliente_id = v_foco.cliente_id
      AND pu.papel = 'agente'
      AND u.ativo = true
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

COMMENT ON FUNCTION public.rpc_atribuir_agente_foco(uuid, uuid, text) IS
  'Distribui ou reatribui um foco_risco para um agente. Exclusivo para supervisores. '
  'Papel verificado via papeis_usuarios.papel (não usuarios.papel_app — coluna removida). '
  'Estados permitidos: em_triagem → aguarda_inspecao (primeira atribuição) ou aguarda_inspecao (reatribuição).';
