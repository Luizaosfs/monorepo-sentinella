-- Migration: add_tipo_evento_sem_acesso
-- Expande o CHECK constraint de tipo_evento para incluir os valores
-- introduzidos pelo fluxo de sem acesso (PR-SEM-ACESSO-02).
-- Apply with: psql $DATABASE_URL -f prisma/migrations/add_tipo_evento_sem_acesso.sql

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
    'retorno_planejado'::text
  ]));
