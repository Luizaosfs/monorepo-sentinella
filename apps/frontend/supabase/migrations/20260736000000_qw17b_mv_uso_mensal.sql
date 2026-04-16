-- QW-17 Sprint B — Materialized View mv_cliente_uso_mensal
--
-- Problema: v_cliente_uso_mensal executa 7 subqueries correlacionadas on-demand.
-- Com 50+ clientes, cada acesso ao AdminQuotas dispara N×7 subqueries simultâneas.
--
-- Solução: materializar a view, refreshar a cada 30min via health-check
-- (que já roda nesse intervalo por QW-12).
--
-- REFRESH CONCURRENTLY não bloqueia leituras — requer índice UNIQUE.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Cria a materialized view como projeção da view regular existente.
--    Qualquer alteração futura em v_cliente_uso_mensal exige recriar também
--    esta MV (DROP + CREATE MATERIALIZED VIEW ... AS SELECT * FROM v_cliente_uso_mensal).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cliente_uso_mensal AS
SELECT * FROM v_cliente_uso_mensal;

-- 2. Índice único em cliente_id — obrigatório para REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS mv_cliente_uso_mensal_cliente_id_idx
  ON mv_cliente_uso_mensal (cliente_id);

-- 3. Função de refresh segura (SECURITY DEFINER para poder ser chamada
--    pela Edge Function com role anon/authenticated).
CREATE OR REPLACE FUNCTION fn_refresh_mv_uso_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cliente_uso_mensal;
END;
$$;

COMMENT ON FUNCTION fn_refresh_mv_uso_mensal() IS
  'QW-17B: Atualiza mv_cliente_uso_mensal sem bloquear leituras. '
  'Chamada pelo health-check a cada 30min.';

GRANT EXECUTE ON FUNCTION fn_refresh_mv_uso_mensal() TO service_role;

-- 4. Permissão de leitura para a role autenticada (RLS não se aplica a MVs).
--    Segurança garantida pela camada de aplicação (api.ts / admin only).
GRANT SELECT ON mv_cliente_uso_mensal TO authenticated;
GRANT SELECT ON mv_cliente_uso_mensal TO service_role;
