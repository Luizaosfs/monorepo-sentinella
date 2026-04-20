-- =============================================================================
-- Fix RLS: job_queue
-- Criada sem RLS em QW-13. Habilitar + policy de leitura por tenant.
-- Escrita continua exclusiva de service_role (Edge Function job-worker).
-- =============================================================================

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- SELECT: admin vê todos; outros usuários veem apenas jobs do próprio cliente
CREATE POLICY "job_queue_select" ON public.job_queue
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      (payload->>'cliente_id') IS NOT NULL
      AND (payload->>'cliente_id')::uuid = public.usuario_cliente_id()
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE para authenticated:
-- apenas service_role e funções SECURITY DEFINER escrevem nesta tabela.

COMMENT ON TABLE public.job_queue IS
  'Fila de jobs assíncronos. RLS: admin vê todos; outros veem apenas '
  'jobs do próprio cliente. Escrita exclusiva por service_role. (QW-13 + Fix S-06)';
