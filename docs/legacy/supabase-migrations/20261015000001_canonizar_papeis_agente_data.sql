-- =============================================================================
-- FASE 1+: Migrar dados e atualizar funções para uso de 'agente'
--
-- PRÉ-REQUISITO: 20261015000000 deve ter sido aplicada (ADD VALUE 'agente').
-- Esta migration roda em transação separada — 'agente' já está no enum.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Migrar dados — converter papéis legados para os canônicos
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. operador → agente (migração principal)
UPDATE public.papeis_usuarios
SET papel = 'agente'
WHERE papel::text = 'operador';

-- 2b. moderador → supervisor (defensivo — caso exista em ambientes divergentes)
UPDATE public.papeis_usuarios
SET papel = 'supervisor'
WHERE papel::text = 'moderador';

-- 2c. Remover papéis mortos (platform_admin, usuario, cliente)
DELETE FROM public.papeis_usuarios
WHERE papel::text IN ('platform_admin', 'usuario', 'cliente');

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3: Constraint de integridade — impede novos dados inválidos
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.papeis_usuarios
  DROP CONSTRAINT IF EXISTS chk_papel_canonico;

ALTER TABLE public.papeis_usuarios
  ADD CONSTRAINT chk_papel_canonico
  CHECK (papel::text IN ('admin', 'supervisor', 'agente', 'notificador'));

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4: Trigger — admin sem cliente_id / demais com cliente_id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_validar_admin_sem_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  SELECT u.cliente_id INTO v_cliente_id
  FROM public.usuarios u
  WHERE u.auth_id = NEW.usuario_id
  LIMIT 1;

  IF NEW.papel::text = 'admin' AND v_cliente_id IS NOT NULL THEN
    RAISE EXCEPTION
      'papel admin não pode ter cliente_id preenchido. '
      'Admin é cross-tenant. Remova o cliente_id do usuário antes de atribuir papel admin.';
  END IF;

  IF NEW.papel::text IN ('supervisor', 'agente', 'notificador') AND v_cliente_id IS NULL THEN
    RAISE EXCEPTION
      'papel % requer cliente_id. '
      'Vincule o usuário a um cliente antes de atribuir este papel.', NEW.papel::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_admin_sem_cliente ON public.papeis_usuarios;

CREATE TRIGGER trg_validar_admin_sem_cliente
  BEFORE INSERT OR UPDATE ON public.papeis_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_admin_sem_cliente();

COMMENT ON FUNCTION public.fn_validar_admin_sem_cliente() IS
  'Impede estados inválidos: admin sem cliente_id; supervisor/agente/notificador com cliente_id nulo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 5: is_agente() — substitui is_operador()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_agente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) = 'agente'
  );
$$;

REVOKE ALL ON FUNCTION public.is_agente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agente() TO authenticated;

COMMENT ON FUNCTION public.is_agente() IS
  'Retorna true se o usuário logado tem papel agente (agente de campo). '
  'Substitui definitivamente is_operador(). JWT fast-path + DB fallback.';

-- is_operador() agora delega para is_agente() — removida em 20261015000002
CREATE OR REPLACE FUNCTION public.is_operador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_agente();
$$;

COMMENT ON FUNCTION public.is_operador() IS
  'DEPRECATED — delega para is_agente(). Removida em 20261015000002.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 6: is_supervisor() — remover referência a 'moderador'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'papel') IS NOT NULL
    THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'supervisor'
    ELSE EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND LOWER(pu.papel::text) = 'supervisor'
    )
  END;
$$;

COMMENT ON FUNCTION public.is_supervisor() IS
  'Retorna true se o usuário logado tem papel supervisor. '
  'Dados migrados — não aceita mais moderador como alias. JWT fast-path + DB fallback.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 7: get_meu_papel() — escada canônica
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM public.papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'agente'      THEN 3
    WHEN 'notificador' THEN 2
    ELSE 0
  END DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_meu_papel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel canônico de maior prioridade. '
  'Escada: admin(5) > supervisor(4) > agente(3) > notificador(2) > morto(0).';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 8: custom_access_token_hook — JWT com 'agente'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid  := (event ->> 'user_id')::uuid;
  v_cliente_id uuid;
  v_ativo      boolean;
  v_papel      text;
  v_plano      text;
  v_claims     jsonb;
BEGIN
  SELECT u.cliente_id, u.ativo
  INTO   v_cliente_id, v_ativo
  FROM   public.usuarios u
  WHERE  u.auth_id = v_user_id
  LIMIT  1;

  SELECT LOWER(pu.papel::text)
  INTO   v_papel
  FROM   public.papeis_usuarios pu
  WHERE  pu.usuario_id = v_user_id
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'agente'      THEN 3
    WHEN 'notificador' THEN 2
    ELSE 0
  END DESC
  LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    SELECT pl.nome
    INTO   v_plano
    FROM   public.cliente_plano cp
    JOIN   public.planos pl ON pl.id = cp.plano_id
    WHERE  cp.cliente_id = v_cliente_id
      AND  cp.ativo = true
    LIMIT  1;
  END IF;

  v_claims := COALESCE(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(
    v_claims,
    '{app_metadata}',
    COALESCE(v_claims -> 'app_metadata', '{}'::jsonb)
    || jsonb_build_object(
         'cliente_id',    v_cliente_id,
         'papel',         v_papel,
         'usuario_ativo', COALESCE(v_ativo, false),
         'plano',         v_plano
       )
  );

  RETURN jsonb_set(event, '{claims}', v_claims);

EXCEPTION WHEN OTHERS THEN
  RETURN event;
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role;
GRANT ALL ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Hook de JWT — injeta papel canônico (admin/supervisor/agente/notificador) no app_metadata.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 9: Documentar enum
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TYPE public.papel_app IS
  'Valores canônicos ATIVOS: admin, supervisor, agente, notificador. '
  'Valores mortos (não atribuir): operador (→agente), usuario, platform_admin. '
  'Constraint chk_papel_canonico bloqueia inserção de valores mortos. '
  'Limpeza definitiva do enum: migration 20261015000002.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 10: Verificação final
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_legados integer;
BEGIN
  SELECT COUNT(*) INTO v_legados
  FROM public.papeis_usuarios
  WHERE papel::text NOT IN ('admin', 'supervisor', 'agente', 'notificador');

  IF v_legados > 0 THEN
    RAISE WARNING '% registros com papel fora do canônico — verificar manualmente.', v_legados;
  ELSE
    RAISE NOTICE 'OK: todos os registros com papel canônico.';
  END IF;
END$$;
