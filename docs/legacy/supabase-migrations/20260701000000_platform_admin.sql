-- =============================================================================
-- platform_admin: role SaaS sem vínculo com cliente
--
-- Motivação: operadores da plataforma Sentinella precisam de acesso total
-- a todos os clientes sem pertencer a nenhuma prefeitura específica.
--
-- Mudanças:
--   1. usuarios.cliente_id passa a ser nullable
--   2. Enum papeis_usuarios.papel recebe 'platform_admin'
--   3. is_admin()                      → inclui platform_admin
--   4. is_platform_admin()             → nova função helper
--   5. usuario_pode_acessar_cliente()  → refatorado para suportar null cliente_id
--   6. get_meu_papel()                 → platform_admin com prioridade máxima (6)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Nullable cliente_id em usuarios
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios ALTER COLUMN cliente_id DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Adicionar 'platform_admin' ao enum de papeis
--    (ALTER TYPE ADD VALUE não pode rodar dentro de transação no PG <14;
--     usamos DO + EXECUTE para isolar o comando)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_enum_type text;
BEGIN
  SELECT udt_name INTO v_enum_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'papeis_usuarios'
    AND column_name  = 'papel';

  IF v_enum_type IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'ALTER TYPE %I ADD VALUE IF NOT EXISTS ''platform_admin''',
        v_enum_type
      );
    EXCEPTION WHEN others THEN
      -- valor já existe ou outro erro não-crítico
      RAISE NOTICE 'Enum update skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. is_platform_admin() — helper dedicado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND pu.papel::text = 'platform_admin'
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Retorna true se o usuário logado possui papel platform_admin (SaaS operator, sem cliente vinculado).';

-- -----------------------------------------------------------------------------
-- 4. is_admin() — agora cobre admin E platform_admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND pu.papel::text IN ('admin', 'platform_admin')
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true para admin (cliente) e platform_admin (SaaS). Use is_platform_admin() para distinguir.';

-- -----------------------------------------------------------------------------
-- 5. usuario_pode_acessar_cliente() — refatorado
--
--    Antes: requeria registro em usuarios com cliente_id correspondente.
--    Agora: admins e platform_admins são verificados diretamente em papeis_usuarios,
--           sem depender de usuarios.cliente_id (que pode ser NULL).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- admin ou platform_admin: acesso a qualquer cliente
  SELECT EXISTS (
    SELECT 1 FROM papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND pu.papel::text IN ('admin', 'platform_admin')
  )
  -- ou usuário normal vinculado ao cliente específico
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id    = auth.uid()
      AND u.cliente_id = p_cliente_id
  );
$$;

COMMENT ON FUNCTION public.usuario_pode_acessar_cliente(uuid) IS
  'Retorna true se o usuário logado pode acessar o cliente informado (próprio cliente, admin, ou platform_admin).';

-- -----------------------------------------------------------------------------
-- 6. get_meu_papel() — platform_admin com prioridade máxima
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'platform_admin' THEN 6
    WHEN 'admin'          THEN 5
    WHEN 'supervisor'     THEN 4
    WHEN 'moderador'      THEN 4
    WHEN 'operador'       THEN 3
    WHEN 'notificador'    THEN 2
    WHEN 'usuario'        THEN 1
    WHEN 'cliente'        THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel mais alto: platform_admin(6) > admin(5) > supervisor(4) > operador(3) > notificador(2) > usuario(1).';

-- -----------------------------------------------------------------------------
-- 7. RLS: usuarios — platform_admin pode ver/editar todos os registros
--    (is_admin() já inclui platform_admin após o passo 4)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usuarios_delete" ON usuarios;
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 8. RLS: papeis_usuarios — platform_admin pode gerenciar papeis
--    (is_admin() já cobre)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "papeis_usuarios_select" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON papeis_usuarios FOR SELECT TO authenticated
  USING (public.is_admin() OR usuario_id = auth.uid());

DROP POLICY IF EXISTS "papeis_usuarios_insert" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_insert" ON papeis_usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "papeis_usuarios_update" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_update" ON papeis_usuarios FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "papeis_usuarios_delete" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_delete" ON papeis_usuarios FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 9. Índice para acelerar is_admin() / is_platform_admin() (warm path em RLS)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_papeis_usuarios_usuario_papel
  ON papeis_usuarios (usuario_id, papel);
