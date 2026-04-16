-- =============================================================================
-- QW-13 — Fila de jobs assíncronos
-- =============================================================================
-- Tabela job_queue: armazena jobs pendentes, em execução e histórico.
-- Função fn_claim_next_job(): claim atômico via FOR UPDATE SKIP LOCKED.
-- A Edge Function job-worker consulta esta fila via cron (*/1 * * * *).
-- =============================================================================

-- ── 1. Tabela job_queue ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}',
  status        text        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'em_execucao', 'concluido', 'falhou', 'cancelado')),
  tentativas    int         NOT NULL DEFAULT 0,
  max_tentativas int        NOT NULL DEFAULT 3,
  executar_em   timestamptz NOT NULL DEFAULT now(),
  iniciado_em   timestamptz,
  concluido_em  timestamptz,
  resultado     jsonb,
  erro          text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_queue IS
  'Fila de jobs assíncronos para processos pesados: triagem IA, sync CNES, relatórios, etc. '
  'Populada por api.jobQueue.enqueue() e drenada pela Edge Function job-worker. (QW-13)';

COMMENT ON COLUMN public.job_queue.tipo IS
  'Tipo de job: triagem_ia | relatorio_semanal | cnes_sync | limpeza_retencao | cloudinary_cleanup | health_check';
COMMENT ON COLUMN public.job_queue.executar_em IS
  'Momento mais cedo em que o job pode ser executado. Usado para backoff com retry.';
COMMENT ON COLUMN public.job_queue.resultado IS
  'JSON com resultado da execução bem-sucedida (opcional, definido pelo handler).';

-- ── 2. Índices ────────────────────────────────────────────────────────────

-- Polling eficiente pelo worker: apenas jobs pendentes, ordenados por prioridade de execução
CREATE INDEX IF NOT EXISTS idx_job_queue_pendente
  ON public.job_queue (executar_em ASC)
  WHERE status = 'pendente';

-- Consultas de status/monitoramento
CREATE INDEX IF NOT EXISTS idx_job_queue_status_criado
  ON public.job_queue (status, criado_em DESC);

-- Filtro por tipo
CREATE INDEX IF NOT EXISTS idx_job_queue_tipo_criado
  ON public.job_queue (tipo, criado_em DESC);

-- ── 3. updated_at automático ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_job_queue_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_queue_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_queue_set_updated_at();

-- ── 4. Claim atômico (FOR UPDATE SKIP LOCKED) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_claim_next_job()
RETURNS SETOF public.job_queue
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM public.job_queue
    WHERE status = 'pendente'
      AND executar_em <= now()
    ORDER BY executar_em ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.job_queue jq
  SET
    status      = 'em_execucao',
    iniciado_em = now()
  FROM claimed
  WHERE jq.id = claimed.id
  RETURNING jq.*;
$$;

COMMENT ON FUNCTION public.fn_claim_next_job IS
  'Atomicamente marca o próximo job pendente como em_execucao. '
  'Usa FOR UPDATE SKIP LOCKED para evitar corrida entre workers concorrentes. (QW-13)';

-- ── 5. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Admin e supervisor podem visualizar toda a fila
CREATE POLICY "job_queue_leitura" ON public.job_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );

-- Somente admin pode cancelar (UPDATE status → 'cancelado')
CREATE POLICY "job_queue_admin_cancelar" ON public.job_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'
    )
  );

-- INSERT via service_role (Edge Functions): RLS não se aplica.
-- Mas usuários autenticados podem enfileirar via RPC segura (ver abaixo).

-- ── 6. RPC pública para enfileirar jobs (SECURITY DEFINER) ───────────────

CREATE OR REPLACE FUNCTION public.fn_enqueue_job(
  p_tipo    text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validação de tipo permitido
  IF p_tipo NOT IN (
    'triagem_ia', 'relatorio_semanal', 'cnes_sync',
    'limpeza_retencao', 'cloudinary_cleanup', 'health_check'
  ) THEN
    RAISE EXCEPTION 'Tipo de job inválido: %', p_tipo;
  END IF;

  INSERT INTO public.job_queue (tipo, payload)
  VALUES (p_tipo, p_payload)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_enqueue_job IS
  'Enfileira um job de forma segura. Valida o tipo antes de inserir. '
  'Pode ser chamada por usuários autenticados (admin/supervisor). (QW-13)';
