-- =============================================================================
-- Corrige listagem de operadores por cliente para perfis não-admin.
--
-- Problema:
-- - Policy "usuarios_select" foi reduzida para (auth_id = auth.uid() OR is_admin()).
-- - Supervisor/operador deixam de enxergar usuários do próprio cliente.
-- - api.usuarios.listPapeis(clienteId) tenta usar RPC get_papeis_by_cliente, mas a
--   função não existe no banco e cai no fallback limitado por RLS.
--
-- Solução:
-- 1) Reabrir SELECT em usuarios para quem pode acessar o cliente.
-- 2) Criar RPC get_papeis_by_cliente com SECURITY DEFINER.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) RLS de leitura em usuarios: permite visualizar usuários do mesmo cliente
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
CREATE POLICY "usuarios_select" ON public.usuarios FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR public.usuario_pode_acessar_cliente(cliente_id)
  );

COMMENT ON POLICY "usuarios_select" ON public.usuarios IS
  'Lê o próprio usuário, admin/platform_admin, ou qualquer usuário de cliente acessível.';

-- -----------------------------------------------------------------------------
-- 2) RPC para listar papéis por cliente (usada pelo frontend)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_papeis_by_cliente(p_cliente_id uuid)
RETURNS TABLE (usuario_id uuid, papel text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    pu.usuario_id,
    LOWER(pu.papel::text) AS papel
  FROM public.papeis_usuarios pu
  JOIN public.usuarios u
    ON u.auth_id = pu.usuario_id
  WHERE u.cliente_id = p_cliente_id
    AND public.usuario_pode_acessar_cliente(p_cliente_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_papeis_by_cliente(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_papeis_by_cliente(uuid) IS
  'Lista usuario_id/papel dos usuários de um cliente quando o usuário logado pode acessar esse cliente.';
