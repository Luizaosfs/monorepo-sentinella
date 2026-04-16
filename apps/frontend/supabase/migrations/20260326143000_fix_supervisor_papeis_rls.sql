-- =============================================================================
-- Corrige RLS para gestão de usuários por supervisor no mesmo cliente.
--
-- Sintoma:
-- - Ao editar usuário no admin, INSERT em papeis_usuarios falha com 42501.
-- - Fluxo usa delete+insert de papel (api.usuarios.setPapel), então políticas de
--   INSERT/DELETE precisam contemplar supervisor.
--
-- Regra:
-- - supervisor/moderador pode gerir usuários do próprio cliente.
-- - supervisor NÃO pode atribuir admin/platform_admin.
-- - operador mantém escopo restrito (operador/usuario).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) IN ('supervisor', 'moderador')
  );
$$;

CREATE OR REPLACE FUNCTION public.supervisor_pode_gerir_usuario(p_usuario_auth_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_supervisor()
    AND public.usuario_cliente_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.auth_id = p_usuario_auth_id
        AND u.cliente_id = public.usuario_cliente_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('supervisor', 'moderador', 'operador', 'notificador', 'usuario');
$$;

-- -----------------------------------------------------------------------------
-- usuarios
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR (
      (public.is_supervisor() OR public.is_operador())
      AND cliente_id = public.usuario_cliente_id()
    )
  );

DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
CREATE POLICY "usuarios_insert" ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      (public.is_supervisor() OR public.is_operador())
      AND cliente_id = public.usuario_cliente_id()
    )
  );

DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
CREATE POLICY "usuarios_update" ON public.usuarios FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      (public.is_supervisor() OR public.is_operador())
      AND cliente_id = public.usuario_cliente_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      (public.is_supervisor() OR public.is_operador())
      AND cliente_id = public.usuario_cliente_id()
    )
  );

DROP POLICY IF EXISTS "usuarios_delete" ON public.usuarios;
CREATE POLICY "usuarios_delete" ON public.usuarios FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(auth_id)
  );

-- -----------------------------------------------------------------------------
-- papeis_usuarios
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "papeis_usuarios_select" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON public.papeis_usuarios FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
    OR public.operador_pode_gerir_usuario(usuario_id)
  );

DROP POLICY IF EXISTS "papeis_usuarios_insert" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_insert" ON public.papeis_usuarios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
    OR (
      public.is_operador()
      AND public.operador_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_operador(papel::text)
    )
  );

DROP POLICY IF EXISTS "papeis_usuarios_update" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_update" ON public.papeis_usuarios FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
    OR public.operador_pode_gerir_usuario(usuario_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
    OR (
      public.is_operador()
      AND public.operador_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_operador(papel::text)
    )
  );

DROP POLICY IF EXISTS "papeis_usuarios_delete" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_delete" ON public.papeis_usuarios FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
    OR public.operador_pode_gerir_usuario(usuario_id)
  );
