-- Migration: add_sem_acesso_fields
-- Adds tentativas_sem_acesso and pendente_decisao_supervisor to focos_risco.
-- Required by: PR-SEM-ACESSO-01 / PR-SEM-ACESSO-02 (fluxo operacional de sem acesso).
-- Apply with: psql $DATABASE_URL -f prisma/migrations/add_sem_acesso_fields.sql

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS tentativas_sem_acesso       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pendente_decisao_supervisor BOOLEAN NOT NULL DEFAULT false;

-- Índice parcial para queries de supervisor (pendente_decisao_supervisor=true)
CREATE INDEX IF NOT EXISTS idx_focos_risco_pendente_supervisor
  ON public.focos_risco (cliente_id)
  WHERE pendente_decisao_supervisor = true AND deleted_at IS NULL;

-- Índice parcial para o status aguardando_nova_tentativa (dashboard e filtros)
CREATE INDEX IF NOT EXISTS idx_focos_risco_aguardando_sem_acesso
  ON public.focos_risco (cliente_id, tentativas_sem_acesso)
  WHERE status = 'aguardando_nova_tentativa' AND deleted_at IS NULL;
