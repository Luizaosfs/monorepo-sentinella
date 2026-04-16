-- =============================================================================
-- Fix Security: mv_cliente_uso_mensal
-- Problema: SELECT * FROM mv_cliente_uso_mensal sem filtro retorna dados de
--           todas as prefeituras para qualquer usuário autenticado.
--           (v_cliente_uso_mensal é segura — já tem security_invoker = on)
-- Solução: revogar acesso direto à MV e criar RPC SECURITY DEFINER que aplica
--          filtro de tenant antes de retornar dados.
-- =============================================================================

-- 1. Revogar acesso direto à MV para authenticated
--    (service_role continua com acesso para o health-check e fn_refresh)
REVOKE SELECT ON mv_cliente_uso_mensal FROM authenticated;

-- 2. RPC para uso próprio: retorna apenas o cliente do usuário autenticado
CREATE OR REPLACE FUNCTION fn_meu_uso_mensal()
RETURNS SETOF mv_cliente_uso_mensal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
BEGIN
  SELECT u.cliente_id INTO v_cliente_id
  FROM usuarios u
  WHERE u.auth_id = auth.uid()
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN; -- usuário sem cliente: não retorna nada
  END IF;

  RETURN QUERY
  SELECT * FROM mv_cliente_uso_mensal
  WHERE cliente_id = v_cliente_id;
END;
$$;

COMMENT ON FUNCTION fn_meu_uso_mensal() IS
  'Retorna uso mensal apenas do cliente do usuário autenticado. '
  'Substitui acesso direto a mv_cliente_uso_mensal (sem filtro = vazamento). '
  'Usado por QuotaBanner e AdminQuotas (visão do próprio cliente). (Fix S-01)';

GRANT EXECUTE ON FUNCTION fn_meu_uso_mensal() TO authenticated;

-- 3. RPC para admin de plataforma: recebe cliente_id explícito
--    Requer is_admin() = true — bloqueia supervisor e operador
CREATE OR REPLACE FUNCTION fn_uso_mensal_todos_clientes()
RETURNS SETOF mv_cliente_uso_mensal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION
      'fn_uso_mensal_todos_clientes: acesso negado — requer papel admin';
  END IF;

  RETURN QUERY SELECT * FROM mv_cliente_uso_mensal ORDER BY cliente_nome;
END;
$$;

COMMENT ON FUNCTION fn_uso_mensal_todos_clientes() IS
  'Lista uso mensal de todos os clientes. Requer papel admin. '
  'Usado por AdminQuotas (visão de plataforma). (Fix S-01)';

GRANT EXECUTE ON FUNCTION fn_uso_mensal_todos_clientes() TO authenticated;
