-- ============================================================
-- P0-S3: CLEANUP-04 — remover policies old-style duplicadas.
-- P0-S4: Garantir que operador não gerencia outros usuários.
--
-- Schema real:
--   papeis_usuarios(usuario_id uuid, papel text)  -- usuario_id = auth.uid()
--   usuarios(id uuid, auth_id uuid, cliente_id uuid, ...)
--   is_admin()     → papeis_usuarios.papel = 'admin'   WHERE usuario_id = auth.uid()
--   is_supervisor() → papel IN ('supervisor','moderador')
--   is_operador()  → papel = 'operador'
-- ============================================================

-- ── P0-S3: Remover policies old-style em tabelas críticas ────────────────────

DO $cleanup$
DECLARE
  _tbl  text;
  _pol  text;
  -- [tabela, policy_legada]
  _old  text[][] := ARRAY[
    ARRAY['usuarios',          'Admins can manage users'],
    ARRAY['usuarios',          'Users can read own data'],
    ARRAY['usuarios',          'usuarios_select_proprio'],
    ARRAY['usuarios',          'usuarios_all_admin_dup'],

    ARRAY['clientes',          'Admins can manage clients'],
    ARRAY['clientes',          'Admins can view clients'],
    ARRAY['clientes',          'clientes_all_admin_dup'],

    ARRAY['levantamentos',     'Admins can manage levantamentos'],
    ARRAY['levantamentos',     'Operators can view levantamentos'],

    ARRAY['levantamento_itens','Operators can view levantamento items'],
    ARRAY['levantamento_itens','Admins can manage levantamento items'],

    ARRAY['sla_operacional',   'Admins can manage sla_operacional'],

    ARRAY['regioes',           'Admins can manage regioes'],
    ARRAY['regioes',           'Users can view regioes']
  ];
  _pair text[];
BEGIN
  FOREACH _pair SLICE 1 IN ARRAY _old LOOP
    _tbl := _pair[1];
    _pol := _pair[2];
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol, _tbl);
  END LOOP;
END $cleanup$;

-- ── P0-S4: usuarios — policies de escrita corretas ───────────────────────────
-- Regras de negócio:
--   admin      → INSERT/UPDATE/DELETE em qualquer usuário do seu cliente
--   supervisor → INSERT/UPDATE em usuários de papel menor (operador, notificador, usuario)
--   operador   → apenas UPDATE no próprio registro (auth_id = auth.uid())
--   notificador, usuario → idem ao operador

-- Limpar policies de escrita que possam existir em versões anteriores
DROP POLICY IF EXISTS "operador_pode_gerir_usuario"      ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin_supervisor"  ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin_supervisor"  ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin"             ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_proprio"           ON public.usuarios;

-- INSERT: apenas admin e supervisor, dentro do próprio cliente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios' AND schemaname = 'public'
    AND policyname = 'usuarios_insert_admin_supervisor'
  ) THEN
    CREATE POLICY "usuarios_insert_admin_supervisor"
      ON public.usuarios
      FOR INSERT
      WITH CHECK (
        (public.is_admin() OR public.is_supervisor())
        AND public.usuario_pode_acessar_cliente(cliente_id)
      );
  END IF;
END $$;

-- UPDATE admin/supervisor: editar qualquer campo em usuários do mesmo cliente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios' AND schemaname = 'public'
    AND policyname = 'usuarios_update_admin_supervisor'
  ) THEN
    CREATE POLICY "usuarios_update_admin_supervisor"
      ON public.usuarios
      FOR UPDATE
      USING (
        (public.is_admin() OR public.is_supervisor())
        AND public.usuario_pode_acessar_cliente(cliente_id)
      )
      WITH CHECK (
        (public.is_admin() OR public.is_supervisor())
        AND public.usuario_pode_acessar_cliente(cliente_id)
      );
  END IF;
END $$;

-- UPDATE próprio: qualquer usuário pode editar apenas seu próprio registro
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios' AND schemaname = 'public'
    AND policyname = 'usuarios_update_proprio'
  ) THEN
    CREATE POLICY "usuarios_update_proprio"
      ON public.usuarios
      FOR UPDATE
      USING  (auth_id = auth.uid())
      WITH CHECK (auth_id = auth.uid());
  END IF;
END $$;

-- DELETE: apenas admin pode remover usuários do seu cliente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios' AND schemaname = 'public'
    AND policyname = 'usuarios_delete_admin'
  ) THEN
    CREATE POLICY "usuarios_delete_admin"
      ON public.usuarios
      FOR DELETE
      USING (
        public.is_admin()
        AND public.usuario_pode_acessar_cliente(cliente_id)
      );
  END IF;
END $$;

-- ── Corrigir operador_pode_gerir_usuario() — sempre false ────────────────────
CREATE OR REPLACE FUNCTION public.operador_pode_gerir_usuario(p_usuario_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Operador nunca gerencia outros usuários. Mantida por compatibilidade de código legado.
  SELECT false
$$;

-- ── Remover is_platform_admin() se ainda existir ─────────────────────────────
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

-- ── Bloquear papel platform_admin via CHECK constraint ───────────────────────
-- papeis_usuarios.papel é o campo correto (não usuarios.papel_app)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'papeis_sem_platform_admin'
    AND conrelid = 'public.papeis_usuarios'::regclass
  ) THEN
    ALTER TABLE public.papeis_usuarios
      ADD CONSTRAINT papeis_sem_platform_admin
      CHECK (LOWER(papel::text) <> 'platform_admin');
  END IF;
END $$;

-- ── focos_risco: garantir policy de leitura canônica se ausente ──────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'focos_risco' AND schemaname = 'public'
    AND policyname = 'focos_risco_select_cliente'
  ) THEN
    CREATE POLICY "focos_risco_select_cliente"
      ON public.focos_risco
      FOR SELECT
      USING (public.usuario_pode_acessar_cliente(cliente_id));
  END IF;
END $$;

-- ── casos_notificados: garantir policy de leitura canônica se ausente ────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'casos_notificados' AND schemaname = 'public'
    AND policyname = 'casos_notificados_select_cliente'
  ) THEN
    CREATE POLICY "casos_notificados_select_cliente"
      ON public.casos_notificados
      FOR SELECT
      USING (public.usuario_pode_acessar_cliente(cliente_id));
  END IF;
END $$;

COMMENT ON COLUMN public.sla_operacional.cliente_id
  IS 'Preenchido pelo trigger de criação de SLA. NULL = item legado pré-migração.';
