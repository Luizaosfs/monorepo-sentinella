-- =============================================================================
-- P1-1: custom_access_token_hook — enriquecimento de JWT com claims de tenant
--
-- OBJETIVO:
--   Inserir no JWT, no momento da emissão (login + refresh), as claims:
--     app_metadata.cliente_id    — UUID do tenant
--     app_metadata.papel         — papel canônico (admin/supervisor/operador/notificador)
--     app_metadata.usuario_ativo — bool (false bloqueia acesso no frontend)
--     app_metadata.plano         — nome do plano SaaS ativo (ex: 'profissional')
--
-- BENEFÍCIOS:
--   1. Frontend lê papel e cliente_id direto do JWT — sem RPC get_meu_papel()
--   2. RLS helpers (is_admin, usuario_pode_acessar_cliente, etc.) usam JWT como
--      fast-path; fallback para DB garante correção em tokens antigos
--   3. Redução de ~2 queries por login; RLS sem joins por request
--
-- SEGURANÇA:
--   - A função é chamada apenas pelo supabase_auth_admin (runtime Supabase Auth)
--   - Claims são somente-leitura no JWT — DB é sempre a fonte da verdade
--   - Em caso de erro: retorna event sem claims extras → comportamento seguro
--   - Staleness máxima: duração do token (padrão Supabase: 1h)
--     → Para revogação imediata: invalidar sessão via Admin API
--
-- ATIVAÇÃO:
--   Local: config.toml [auth.hook.custom_access_token]
--   Hosted: Dashboard → Authentication → Hooks → Custom Access Token
-- =============================================================================

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
  -- ── 1. Dados básicos do usuário ──────────────────────────────────────────
  SELECT u.cliente_id, u.ativo
  INTO   v_cliente_id, v_ativo
  FROM   public.usuarios u
  WHERE  u.auth_id = v_user_id
  LIMIT  1;

  -- ── 2. Papel de maior prioridade (mesma escada do get_meu_papel) ─────────
  SELECT LOWER(pu.papel::text)
  INTO   v_papel
  FROM   public.papeis_usuarios pu
  WHERE  pu.usuario_id = v_user_id
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'moderador'   THEN 4
    WHEN 'operador'    THEN 3
    WHEN 'notificador' THEN 2
    ELSE 0
  END DESC
  LIMIT 1;

  -- ── 3. Plano SaaS ativo do cliente ───────────────────────────────────────
  IF v_cliente_id IS NOT NULL THEN
    SELECT pl.nome
    INTO   v_plano
    FROM   public.cliente_plano cp
    JOIN   public.planos pl ON pl.id = cp.plano_id
    WHERE  cp.cliente_id = v_cliente_id
      AND  cp.status     = 'ativo'
    LIMIT 1;
  END IF;

  -- ── 4. Injetar claims em app_metadata ────────────────────────────────────
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
  -- Falha não deve bloquear o login — retornar event intocado
  RETURN event;
END;
$$;

-- Somente o runtime do Supabase Auth pode invocar este hook
REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'P1-1: Hook de JWT — injeta cliente_id, papel, usuario_ativo e plano em '
  'app_metadata. Invocado pelo Supabase Auth em cada emissão/refresh de token. '
  'Em caso de erro retorna o event sem modificação (fail-safe).';

-- =============================================================================
-- P1-1: Atualizar helpers RLS para usar JWT claims (fast-path) + DB fallback
--
-- MODELO:
--   1. Tentar ler da claim app_metadata (O(1), sem query)
--   2. Se ausente (token emitido antes do hook), fallback para DB query
--
-- INVARIANTE DE SEGURANÇA:
--   Funções STABLE: PostgreSQL caches por transação → consistência intra-request.
--   Claims refletem o estado no momento do último login/refresh do token (≤ 1h).
--   Para mudanças de papel com efeito imediato: invalidar sessão via Admin API.
-- =============================================================================

-- ── is_admin() ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- Fast-path: claim presente e válida
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'papel' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'admin'
      -- Fallback: DB (tokens pré-hook ou claim ausente)
      ELSE EXISTS (
        SELECT 1 FROM public.papeis_usuarios pu
        WHERE pu.usuario_id = auth.uid()
          AND pu.papel::text = 'admin'
      )
    END;
$$;

-- ── is_supervisor() ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'papel' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'papel') IN ('supervisor', 'moderador')
      ELSE EXISTS (
        SELECT 1 FROM public.papeis_usuarios pu
        WHERE pu.usuario_id = auth.uid()
          AND LOWER(pu.papel::text) IN ('supervisor', 'moderador')
      )
    END;
$$;

-- ── is_operador() ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_operador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'papel' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'operador'
      ELSE EXISTS (
        SELECT 1 FROM public.papeis_usuarios pu
        WHERE pu.usuario_id = auth.uid()
          AND LOWER(pu.papel::text) = 'operador'
      )
    END;
$$;

-- ── is_notificador() ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_notificador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'papel' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'notificador'
      ELSE EXISTS (
        SELECT 1 FROM public.papeis_usuarios pu
        WHERE pu.usuario_id = auth.uid()
          AND LOWER(pu.papel::text) = 'notificador'
      )
    END;
$$;

-- ── usuario_cliente_id() ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.usuario_cliente_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'cliente_id' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'cliente_id')::uuid
      ELSE (
        SELECT u.cliente_id FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
        LIMIT 1
      )
    END;
$$;

-- ── usuario_pode_acessar_cliente(uuid) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- Admin: acesso global
    public.is_admin()
    -- Não-admin: cliente_id do JWT ou da tabela usuarios deve bater
    OR CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'cliente_id' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'cliente_id')::uuid = p_cliente_id
      ELSE EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id    = auth.uid()
          AND u.cliente_id = p_cliente_id
      )
    END;
$$;

COMMENT ON FUNCTION public.is_admin()                           IS 'P1-1: JWT fast-path + DB fallback.';
COMMENT ON FUNCTION public.is_supervisor()                      IS 'P1-1: JWT fast-path + DB fallback. Aceita moderador como alias.';
COMMENT ON FUNCTION public.is_operador()                        IS 'P1-1: JWT fast-path + DB fallback.';
COMMENT ON FUNCTION public.is_notificador()                     IS 'P1-1: JWT fast-path + DB fallback.';
COMMENT ON FUNCTION public.usuario_cliente_id()                 IS 'P1-1: JWT fast-path + DB fallback.';
COMMENT ON FUNCTION public.usuario_pode_acessar_cliente(uuid)   IS 'P1-1: JWT fast-path + DB fallback. Admin bypassa tenant check.';
