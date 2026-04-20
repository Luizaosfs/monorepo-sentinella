-- ============================================================
-- FIX-RLS-01: Endurecer permissões em usuarios e papeis_usuarios
-- Problema: is_operador() concedia acesso indevido de listagem,
--           inserção e edição de usuários do cliente.
--           Policies duplicadas expandiam acesso por semântica OR.
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1: usuarios — dropar legados e corrigir policies ativas
-- ============================================================

-- Policies antigas geradas por migrations iniciais (sobrepostas por OR):
DROP POLICY IF EXISTS "Admins atualizam usuarios"     ON public.usuarios;
DROP POLICY IF EXISTS "Admins deletam usuarios"       ON public.usuarios;
DROP POLICY IF EXISTS "Admins inserem usuarios"       ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios veem seu proprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own"           ON public.usuarios; -- redundante com usuarios_select

-- SELECT: próprio row | admin | supervisor do mesmo cliente
-- REMOVE is_operador() que estava aqui
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );

-- INSERT: admin | supervisor do mesmo cliente
-- REMOVE is_operador() que estava aqui
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );

-- UPDATE outros usuários: admin | supervisor do mesmo cliente
-- usuarios_update_own (auth.uid() = auth_id) é mantida — cada usuário edita o próprio registro
-- REMOVE is_operador() que estava aqui
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );

-- DELETE mantém: is_admin() OR supervisor_pode_gerir_usuario — sem alteração necessária

-- ============================================================
-- PARTE 2: papeis_usuarios — dropar legado e remover operador
-- ============================================================

-- "Admins gerenciam todos os papeis" é uma policy ALL que,
-- por semântica OR do PostgreSQL, se combina com as por-operação
-- e pode expandir acesso inesperadamente. Substituída pelas individuais.
DROP POLICY IF EXISTS "Admins gerenciam todos os papeis" ON public.papeis_usuarios;

-- "Usuarios leem seus proprios papeis" (usuario_id = auth.uid()) é mantida —
-- é a política mais restrita e garante que qualquer perfil veja seus próprios papéis.

-- SELECT: próprio row | admin | supervisor do mesmo cliente (sem operador)
DROP POLICY IF EXISTS "papeis_usuarios_select" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON public.papeis_usuarios
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );

-- INSERT: admin | supervisor (apenas papéis permitidos — sem admin/supervisor para terceiros)
DROP POLICY IF EXISTS "papeis_usuarios_insert" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_insert" ON public.papeis_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );

-- UPDATE: admin | supervisor (mesma restrição de papéis)
DROP POLICY IF EXISTS "papeis_usuarios_update" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_update" ON public.papeis_usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );

-- DELETE: admin | supervisor (sem operador)
DROP POLICY IF EXISTS "papeis_usuarios_delete" ON public.papeis_usuarios;
CREATE POLICY "papeis_usuarios_delete" ON public.papeis_usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );

-- ============================================================
-- PARTE 3: papel_permitido_para_supervisor — restringir escopo
-- Supervisor NÃO pode atribuir supervisor/admin/moderador a terceiros.
-- Pode apenas criar/alterar operador, notificador.
-- ============================================================
CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('operador', 'notificador');
$$;

COMMENT ON FUNCTION public.papel_permitido_para_supervisor(text) IS
  'Papéis que supervisor pode atribuir a usuários do próprio cliente. '
  'Excluídos: admin, supervisor, moderador, usuario (legado).';

-- ============================================================
-- PARTE 4: remover funções de operador não mais referenciadas
-- ============================================================
DROP FUNCTION IF EXISTS public.operador_pode_gerir_usuario(uuid);
DROP FUNCTION IF EXISTS public.papel_permitido_para_operador(text);

COMMIT;
