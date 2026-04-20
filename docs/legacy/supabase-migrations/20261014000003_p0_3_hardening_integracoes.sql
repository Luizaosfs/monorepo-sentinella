-- =============================================================================
-- P0-3: Endurecimento de cliente_integracoes e segredos sensíveis
--
-- PROBLEMA:
--   As policies canônicas criadas em 20260914000002 usam usuario_pode_acessar_cliente()
--   para todas as operações — isso permite que operador e notificador leiam api_key
--   em texto claro. A api_key é uma credencial de serviço externo (e-SUS Notifica).
--
-- MODELO DE ACESSO CORRETO:
--   SELECT metadados  → admin ou supervisor do cliente
--   SELECT api_key    → nunca via SELECT direto; apenas via RPC get_integracao_api_key()
--   INSERT/UPDATE     → admin da plataforma apenas
--   DELETE            → admin da plataforma apenas
--
-- AUDITORIA:
--   get_integracao_api_key() já corrigida em P0-1 (join direto em papeis_usuarios).
--   Esta migration adiciona a chamada registrar_audit() dentro da função.
-- =============================================================================

-- ── 1. Restringir SELECT de cliente_integracoes a admin+supervisor ─────────────
-- A policy atual (20260914000002) usa usuario_pode_acessar_cliente() — muito ampla.
DROP POLICY IF EXISTS "cliente_integracoes_select" ON public.cliente_integracoes;
CREATE POLICY "cliente_integracoes_select" ON public.cliente_integracoes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_supervisor() AND public.usuario_pode_acessar_cliente(cliente_id))
  );

-- ── 2. Restringir INSERT/UPDATE/DELETE a admin da plataforma apenas ────────────
DROP POLICY IF EXISTS "cliente_integracoes_insert" ON public.cliente_integracoes;
CREATE POLICY "cliente_integracoes_insert" ON public.cliente_integracoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cliente_integracoes_update" ON public.cliente_integracoes;
CREATE POLICY "cliente_integracoes_update" ON public.cliente_integracoes
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cliente_integracoes_delete" ON public.cliente_integracoes;
CREATE POLICY "cliente_integracoes_delete" ON public.cliente_integracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 3. Atualizar get_integracao_api_key() com trilha de auditoria ─────────────
-- Esta função foi corrigida em P0-1 (join direto via is_admin/is_supervisor).
-- Aqui adicionamos a chamada registrar_audit() sempre que a chave for revelada.
CREATE OR REPLACE FUNCTION public.get_integracao_api_key(p_integracao_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key    text;
  v_cliente_id uuid;
BEGIN
  SELECT ci.api_key, ci.cliente_id
  INTO v_api_key, v_cliente_id
  FROM public.cliente_integracoes ci
  WHERE ci.id = p_integracao_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Integração não encontrada';
  END IF;

  -- Verificar: admin global OU supervisor do mesmo cliente
  IF NOT (
    public.is_admin()
    OR (public.is_supervisor() AND public.usuario_cliente_id() = v_cliente_id)
  ) THEN
    RAISE EXCEPTION 'Acesso negado — apenas admin ou supervisor do cliente podem visualizar a chave';
  END IF;

  -- Registrar auditoria antes de retornar a chave
  PERFORM public.registrar_audit(
    v_cliente_id,
    'integracao_api_key_vista',
    'cliente_integracoes',
    p_integracao_id,
    'Chave de API visualizada pelo usuário'
  );

  RETURN v_api_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_integracao_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_integracao_api_key(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_integracao_api_key(uuid) IS
  'Retorna a api_key completa de uma integração. '
  'Requer papel admin (global) ou supervisor do mesmo cliente. '
  'Registra auditoria em audit_log com ação integracao_api_key_vista.';

-- ── 4. Documentação do modelo de acesso ───────────────────────────────────────
COMMENT ON TABLE public.cliente_integracoes IS
  'Configurações de integração por cliente (e-SUS Notifica, RNDS). '
  'RLS: SELECT restrito a admin+supervisor; INSERT/UPDATE/DELETE apenas admin. '
  'api_key NUNCA deve ser lida via SELECT direto pelo frontend — usar RPC '
  'get_integracao_api_key() que valida perfil e registra auditoria. '
  'Campo api_key_masked disponível para exibição segura (GENERATED ALWAYS STORED).';
