-- =============================================================================
-- FIX-03: Dropar funções órfãs que referenciam status_atendimento
--
-- Contexto: a migration 20260711 removeu a coluna status_atendimento de
-- levantamento_itens. A migration A01 (20260911000000) dropou os triggers
-- órfãos, mas as funções subjacentes permanecem no banco como código morto.
--
-- Funções a dropar:
--   fn_validar_transicao_status_atendimento() — criada em 20260604, trigger dropado em A01
--   (fn_levantamento_item_status_historico não foi criada como função separada — o trigger
--    usava a função diretamente; se existir como função separada, também dropa)
-- =============================================================================

-- Dropar função de validação de transição (trigger já removido em A01)
DROP FUNCTION IF EXISTS public.fn_validar_transicao_status_atendimento();

-- Dropar variantes possíveis (sem argumentos ou com argumentos trigger)
DROP FUNCTION IF EXISTS public.fn_validar_transicao_status_atendimento() CASCADE;

-- Documentar tabela de histórico legada (dados preservados, não inserir mais)
COMMENT ON TABLE public.levantamento_item_status_historico IS
  'LEGADO — histórico de levantamento_itens.status_atendimento (coluna removida em 20260711). '
  'Dados históricos preservados para auditoria. '
  'NÃO inserir novos registros: novas transições de foco são registradas em foco_risco_historico. '
  'Trigger trg_levantamento_item_status_historico dropado em A01/A06 (20260911000000/20260911020000). '
  'Função fn_validar_transicao_status_atendimento dropada em FIX-03 (20260913000002).';
