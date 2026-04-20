-- =============================================================================
-- Reverte platform_admin → admin
--
-- Decisão: admin = equipe Sentinella (SaaS, sem cliente vinculado)
--          supervisor = administrador da prefeitura (tem cliente)
--
-- platform_admin não será removido do enum (PostgreSQL não suporta DROP VALUE),
-- mas nenhum registro usará esse valor a partir de agora.
-- =============================================================================

-- 1. Migrar registros existentes platform_admin → admin
UPDATE papeis_usuarios
SET papel = 'admin'
WHERE papel::text = 'platform_admin';

-- 2. Restaurar is_admin() — apenas 'admin' (equipe Sentinella)
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
      AND pu.papel::text = 'admin'
  );
$$;

-- 3. Restaurar usuario_pode_acessar_cliente() — sem platform_admin
--    admin (equipe Sentinella) acessa qualquer cliente
--    demais usuários acessam apenas o próprio cliente
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND pu.papel::text = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id    = auth.uid()
      AND u.cliente_id = p_cliente_id
  );
$$;

-- 4. Restaurar get_meu_papel() — platform_admin tratado como admin (fallback seguro)
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE LOWER(pu.papel::text)
      WHEN 'platform_admin' THEN 'admin'   -- fallback: trata como admin
      ELSE LOWER(pu.papel::text)
    END
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'platform_admin' THEN 5
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
  'admin(5)=equipe Sentinella > supervisor(4)=admin prefeitura > operador(3) > notificador(2) > usuario(1). usuarios.cliente_id pode ser NULL para admin.';
