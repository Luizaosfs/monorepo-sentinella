-- QW-17 Sprint A — Round-robin job claiming
-- Substitui fn_claim_next_job (FIFO global) por fn_claim_jobs_round_robin:
-- aloca 1 job por cliente distinto, até p_max jobs em paralelo.
-- Garante que clientes com filas longas não bloqueiem clientes menores.
-- Jobs sem cliente_id (platform-level: limpeza, health-check…) formam um
-- slot único chamado 'platform'.

CREATE OR REPLACE FUNCTION fn_claim_jobs_round_robin(p_max int DEFAULT 5)
RETURNS SETOF job_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- 1. Seleciona o job mais antigo elegível de cada cliente distinto,
  --    agrupando NULLs sob o slot 'platform'. Respeita executar_em.
  SELECT array_agg(id ORDER BY executar_em ASC) INTO v_ids
  FROM (
    SELECT DISTINCT ON (COALESCE(cliente_id::text, 'platform'))
      id,
      executar_em
    FROM job_queue
    WHERE status     = 'pendente'
      AND executar_em <= now()
    ORDER BY
      COALESCE(cliente_id::text, 'platform'),
      executar_em ASC
    LIMIT p_max
  ) candidatos;

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- 2. Clama atomicamente (guard status = 'pendente' evita double-claim).
  RETURN QUERY
    UPDATE job_queue
       SET status      = 'processando',
           iniciado_em = now()
     WHERE id          = ANY(v_ids)
       AND status      = 'pendente'
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION fn_claim_jobs_round_robin(int) IS
  'QW-17: aloca até p_max jobs, 1 por cliente, em round-robin. '
  'Evita starvation quando um cliente tem fila longa.';

GRANT EXECUTE ON FUNCTION fn_claim_jobs_round_robin(int) TO service_role;
