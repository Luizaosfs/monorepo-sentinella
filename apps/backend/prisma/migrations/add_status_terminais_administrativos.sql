-- Migration: add_status_terminais_administrativos
-- Adds 'encaminhado_administrativo' and 'acionado_juridico' to the
-- focos_risco status CHECK constraint.
-- These are terminal states handled by TransicionarFocoRisco (STATUS_FECHAMENTO)
-- and allowed by TRANSICOES_VALIDAS from 'aguardando_nova_tentativa'.
-- Apply with: psql $DATABASE_URL -f prisma/migrations/add_status_terminais_administrativos.sql

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
    'aguardando_nova_tentativa'::text,
    'encaminhado_administrativo'::text,
    'acionado_juridico'::text
  ]));
