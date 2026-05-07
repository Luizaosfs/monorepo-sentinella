-- Migration: add_tipo_evento_supervisor_actions
-- Adds 'reagendamento_supervisor' and 'manter_ativa_supervisor' to the
-- foco_risco_historico tipo_evento CHECK constraint.
-- These values are used by use-cases/reagendar-visita.ts and
-- use-cases/manter-ativa.ts and were missing, causing 500 on those endpoints.
-- Apply with: psql $DATABASE_URL -f prisma/migrations/add_tipo_evento_supervisor_actions.sql

ALTER TABLE public.foco_risco_historico
  DROP CONSTRAINT IF EXISTS foco_risco_historico_tipo_evento_check;

ALTER TABLE public.foco_risco_historico
  ADD CONSTRAINT foco_risco_historico_tipo_evento_check
  CHECK (tipo_evento = ANY (ARRAY[
    'transicao_status'::text,
    'classificacao_alterada'::text,
    'dados_minimos_completos'::text,
    'inspecao_iniciada'::text,
    'atribuicao_responsavel'::text,
    'mudanca_status'::text,
    'criacao'::text,
    'reinspecao_realizada'::text,
    'reinspecao_agendada'::text,
    'sem_acesso_registrado'::text,
    'escalado_supervisor'::text,
    'retorno_planejado'::text,
    'reagendamento_supervisor'::text,
    'manter_ativa_supervisor'::text
  ]));
