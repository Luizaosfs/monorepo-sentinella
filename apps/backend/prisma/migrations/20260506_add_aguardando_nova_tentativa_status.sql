-- Migration: add_aguardando_nova_tentativa_status
-- Adds 'aguardando_nova_tentativa' to focos_risco status CHECK constraint.
-- The previous migration (add_sem_acesso_fields.sql) created indexes referencing
-- this status but forgot to add it to the constraint. Applying this fixes
-- all sem-acesso use-case calls that were failing with a constraint violation.
-- Apply with: psql $DATABASE_URL -f prisma/migrations/20260506_add_aguardando_nova_tentativa_status.sql

ALTER TABLE public.focos_risco DROP CONSTRAINT IF EXISTS focos_risco_status_check;
ALTER TABLE public.focos_risco ADD CONSTRAINT focos_risco_status_check
  CHECK (status = ANY (ARRAY[
    'suspeita'::text,
    'em_triagem'::text,
    'aguarda_inspecao'::text,
    'em_inspecao'::text,
    'confirmado'::text,
    'em_tratamento'::text,
    'resolvido'::text,
    'descartado'::text,
    'aguardando_nova_tentativa'::text
  ]));
