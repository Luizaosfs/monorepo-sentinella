-- =============================================================================
-- B04: Índice em operacoes(cliente_id, status) para queries de listagem
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_operacoes_cliente_status
  ON public.operacoes (cliente_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_operacoes_cliente_status IS
  'B04: Acelera listagem de operações ativas por cliente e status.';
