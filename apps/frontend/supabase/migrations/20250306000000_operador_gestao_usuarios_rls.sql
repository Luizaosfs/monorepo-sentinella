-- =============================================================================
-- RLS OPERADOR — Gestão de usuários no papel de operador
-- Operador pode ver/editar/criar usuários apenas do seu cliente (usuarios.cliente_id).
-- Operador pode atribuir apenas papéis 'operador' e 'usuario'. Não pode deletar
-- usuários (apenas admin). Execute após 20250302100000_rls_geral_todas_tabelas.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funções auxiliares para operador
-- -----------------------------------------------------------------------------

-- Retorna o cliente_id do usuário logado (NULL se não existir em usuarios).
CREATE OR REPLACE FUNCTION public.usuario_cliente_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.cliente_id FROM usuarios u WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

-- Retorna true se o usuário logado tem papel 'operador' em papeis_usuarios.
-- Usa pu.papel::text para não converter string em enum (papel pode ser tipo papel_app).
CREATE OR REPLACE FUNCTION public.is_operador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    WHERE u.auth_id = auth.uid() AND LOWER(pu.papel::text) = 'operador'
  );
$$;

-- Retorna true se o papel é permitido para operador atribuir (apenas 'operador' e 'usuario').
-- LOWER para funcionar mesmo se o enum usar 'Operador'/'Usuario'.
CREATE OR REPLACE FUNCTION public.papel_permitido_para_operador(p_papel text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('operador', 'usuario');
$$;

-- Retorna true se o usuario_id (auth_id) pertence a um usuario do mesmo cliente do operador.
CREATE OR REPLACE FUNCTION public.operador_pode_gerir_usuario(p_usuario_auth_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_operador()
  AND public.usuario_cliente_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id = p_usuario_auth_id
    AND u.cliente_id = public.usuario_cliente_id()
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. USUARIOS — estender políticas: operador vê/insere/atualiza só do seu cliente
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR (public.is_operador() AND cliente_id = public.usuario_cliente_id())
  );

DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_operador() AND cliente_id = public.usuario_cliente_id())
  );

DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_operador() AND cliente_id = public.usuario_cliente_id())
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_operador() AND cliente_id = public.usuario_cliente_id())
  );

-- DELETE continua só admin (operador não remove usuários)
DROP POLICY IF EXISTS "usuarios_delete" ON usuarios;
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. PAPEIS_USUARIOS — operador vê/insere/atualiza/remove apenas para usuários do seu cliente e papéis operador/usuario
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "papeis_usuarios_select" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON papeis_usuarios FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.operador_pode_gerir_usuario(usuario_id)
  );

DROP POLICY IF EXISTS "papeis_usuarios_insert" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_insert" ON papeis_usuarios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operador()
      AND public.papel_permitido_para_operador(papel::text)
      AND public.operador_pode_gerir_usuario(usuario_id)
    )
  );

DROP POLICY IF EXISTS "papeis_usuarios_update" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_update" ON papeis_usuarios FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.operador_pode_gerir_usuario(usuario_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operador()
      AND public.papel_permitido_para_operador(papel::text)
      AND public.operador_pode_gerir_usuario(usuario_id)
    )
  );

DROP POLICY IF EXISTS "papeis_usuarios_delete" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_delete" ON papeis_usuarios FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.operador_pode_gerir_usuario(usuario_id)
  );
