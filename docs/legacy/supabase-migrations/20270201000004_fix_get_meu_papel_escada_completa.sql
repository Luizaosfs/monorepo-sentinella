-- =============================================================================
-- 20270201000004 — Corrigir escada de prioridade em get_meu_papel e custom_access_token_hook
--
-- PROBLEMA:
--   Ambas as funções usavam escada incompleta:
--     admin(5) > supervisor/moderador(4) > operador(3) > notificador(2) > ELSE 0
--   Faltavam: agente (canônico desde 20261015000001) e analista_regional (P5).
--   Resultado: agente e analista_regional caíam em ELSE 0, mas ainda eram retornados
--   corretamente por LIMIT 1. O risco real era com moderador: RPC retornava 'moderador'
--   mas normalizePapel() retornava null (não mapeava moderador → supervisor).
--
-- CORREÇÃO:
--   - Escada atualizada: admin(5) > supervisor/moderador(4) > agente/operador(3) >
--                        notificador(2) > analista_regional(1) > ELSE 0
--   - Garante que todos os papéis canônicos têm prioridade explícita
-- =============================================================================

-- ── get_meu_papel() ───────────────────────────────────────────────────────────
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
    WHEN 'admin'             THEN 5
    WHEN 'supervisor'        THEN 4
    WHEN 'moderador'         THEN 4  -- alias histórico de supervisor
    WHEN 'agente'            THEN 3
    WHEN 'operador'          THEN 3  -- alias legado de agente
    WHEN 'notificador'       THEN 2
    WHEN 'analista_regional' THEN 1
    ELSE 0                           -- platform_admin (morto), desconhecido
  END DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_meu_papel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel de maior prioridade do usuário logado. '
  'Escada: admin(5) > supervisor/moderador(4) > agente/operador(3) > notificador(2) > analista_regional(1) > legado/morto(0). '
  'moderador é alias histórico de supervisor. operador é alias legado de agente.';

-- ── custom_access_token_hook — escada atualizada ──────────────────────────────
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
    WHEN 'admin'             THEN 5
    WHEN 'supervisor'        THEN 4
    WHEN 'moderador'         THEN 4
    WHEN 'agente'            THEN 3
    WHEN 'operador'          THEN 3
    WHEN 'notificador'       THEN 2
    WHEN 'analista_regional' THEN 1
    ELSE 0
  END DESC
  LIMIT 1;

  IF v_cliente_id IS NOT NULL THEN
    SELECT pl.nome
    INTO   v_plano
    FROM   public.cliente_plano cp
    JOIN   public.planos pl ON pl.id = cp.plano_id
    WHERE  cp.cliente_id = v_cliente_id
      AND  cp.status     = 'ativo'
    LIMIT 1;
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

REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
REVOKE ALL  ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Hook de JWT — injeta cliente_id, papel, usuario_ativo e plano em app_metadata. '
  'Escada completa: admin(5) > supervisor/moderador(4) > agente/operador(3) > notificador(2) > analista_regional(1).';
