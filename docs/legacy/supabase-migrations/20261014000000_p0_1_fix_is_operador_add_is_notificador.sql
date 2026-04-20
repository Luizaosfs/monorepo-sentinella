-- =============================================================================
-- P0-1: Corrigir is_operador() + adicionar is_notificador()
--
-- Problema: is_operador() foi definida em 20250306000000 com padrão legado
--   JOIN papeis_usuarios ON pu.usuario_id = u.auth_id WHERE u.auth_id = auth.uid()
--   → join desnecessário passando por usuarios.auth_id
--
-- Correção: consulta direta em papeis_usuarios.usuario_id = auth.uid()
--   (mesmo padrão usado por is_admin(), is_supervisor(), get_meu_papel())
--
-- Adicionado: is_notificador() — nunca foi definida; causava fallback ad-hoc
--   onde código verificava papel inline em vez de usar helper canônico
-- =============================================================================

-- ── is_operador() ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_operador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) = 'operador'
  );
$$;

COMMENT ON FUNCTION public.is_operador() IS
  'Retorna true se o usuário logado tem papel operador. '
  'Consulta direta em papeis_usuarios (sem join intermediário por usuarios).';

-- ── is_notificador() ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_notificador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) = 'notificador'
  );
$$;

COMMENT ON FUNCTION public.is_notificador() IS
  'Retorna true se o usuário logado tem papel notificador (funcionário UBS/hospital). '
  'Consulta direta em papeis_usuarios — mesmo padrão de is_admin/is_supervisor/is_operador.';
