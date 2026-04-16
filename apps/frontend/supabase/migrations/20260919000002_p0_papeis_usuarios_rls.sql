-- ============================================================
-- P0-S4 (complemento): RLS de papeis_usuarios
-- Garante que operador não pode criar/remover papéis de outros usuários.
--
-- Schema: papeis_usuarios(usuario_id uuid, papel text)
--   usuario_id = auth.uid() diretamente (não passa por usuarios.auth_id)
-- ============================================================

ALTER TABLE public.papeis_usuarios ENABLE ROW LEVEL SECURITY;

-- Limpar policies legadas
DO $cleanup$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'papeis_usuarios' AND schemaname = 'public'
    AND policyname IN (
      'papeis_usuarios_select_tem_papel',
      'papeis_usuarios_insert_tem_papel',
      'papeis_usuarios_delete_tem_papel',
      'papeis_usuarios_select_all',
      'papeis_usuarios_all_admin',
      'Admins can manage papeis'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.papeis_usuarios', r.policyname);
  END LOOP;
END $cleanup$;

-- SELECT: usuário vê os próprios papéis; admin/supervisor vê todos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'papeis_usuarios' AND schemaname = 'public'
    AND policyname = 'papeis_usuarios_select_cliente'
  ) THEN
    CREATE POLICY "papeis_usuarios_select_cliente"
      ON public.papeis_usuarios
      FOR SELECT
      USING (
        usuario_id = auth.uid()               -- próprio usuário
        OR public.is_admin()                  -- admin vê todos
        OR public.is_supervisor()             -- supervisor vê todos do cliente
      );
  END IF;
END $$;

-- INSERT: apenas admin e supervisor criam novos papéis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'papeis_usuarios' AND schemaname = 'public'
    AND policyname = 'papeis_usuarios_insert_admin_supervisor'
  ) THEN
    CREATE POLICY "papeis_usuarios_insert_admin_supervisor"
      ON public.papeis_usuarios
      FOR INSERT
      WITH CHECK (public.is_admin() OR public.is_supervisor());
  END IF;
END $$;

-- UPDATE: apenas admin e supervisor alteram papéis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'papeis_usuarios' AND schemaname = 'public'
    AND policyname = 'papeis_usuarios_update_admin_supervisor'
  ) THEN
    CREATE POLICY "papeis_usuarios_update_admin_supervisor"
      ON public.papeis_usuarios
      FOR UPDATE
      USING  (public.is_admin() OR public.is_supervisor())
      WITH CHECK (public.is_admin() OR public.is_supervisor());
  END IF;
END $$;

-- DELETE: apenas admin remove papéis
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'papeis_usuarios' AND schemaname = 'public'
    AND policyname = 'papeis_usuarios_delete_admin'
  ) THEN
    CREATE POLICY "papeis_usuarios_delete_admin"
      ON public.papeis_usuarios
      FOR DELETE
      USING (public.is_admin());
  END IF;
END $$;

-- ── papel_permitido_para_supervisor() ────────────────────────────────────────
-- Supervisor pode criar: operador, notificador, usuario
-- Supervisor NÃO pode criar: admin, supervisor, moderador
CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('operador', 'notificador', 'usuario')
$$;
