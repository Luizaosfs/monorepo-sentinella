-- Fix: expandir CHECK constraint de tipo_evento em foco_risco_historico
-- A constraint original só permitia 4 valores; os use-cases introduziram novos tipos.
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
    'reinspecao_agendada'::text
  ]));
