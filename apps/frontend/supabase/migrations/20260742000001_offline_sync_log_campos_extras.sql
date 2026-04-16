-- Melhoria de observabilidade: campos extras em offline_sync_log
-- Permite rastrear qual operação específica falhou e quantas vezes foi tentada.

ALTER TABLE public.offline_sync_log
  ADD COLUMN IF NOT EXISTS retry_count      int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key  uuid,
  ADD COLUMN IF NOT EXISTS cliente_id       uuid         REFERENCES public.clientes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.offline_sync_log.retry_count     IS 'Número de tentativas realizadas antes de registrar a falha.';
COMMENT ON COLUMN public.offline_sync_log.idempotency_key IS 'UUID da operação offline — permite correlacionar com a fila do IndexedDB.';
COMMENT ON COLUMN public.offline_sync_log.cliente_id      IS 'Cliente ao qual a operação pertence — facilita triagem por prefeitura.';

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_cliente
  ON public.offline_sync_log (cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_idem_key
  ON public.offline_sync_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
