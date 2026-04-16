-- =============================================================================
-- CLEANUP-02: Dropar função órfã trg_levantamento_item_status_historico()
--
-- Contexto:
--   - Trigger trg_levantamento_item_status_historico dropado em A01 (20260911000000)
--   - fn_validar_transicao_status_atendimento() dropada em FIX-03 (20260913000002)
--   - A função trg_levantamento_item_status_historico() ainda existe como código morto
--
-- A função referencia status_atendimento (coluna removida em 20260711) e
-- acao_aplicada (também removida). Sem trigger, nunca será chamada — mas polui pg_proc.
-- =============================================================================

-- Dropar função órfã do trigger de histórico
DROP FUNCTION IF EXISTS public.trg_levantamento_item_status_historico();

-- Redundante mas idempotente: garantir que fn_validar_transicao também não existe
-- (já dropada em FIX-03, mantida aqui para caso de ambientes que não rodaram FIX-03)
DROP FUNCTION IF EXISTS public.fn_validar_transicao_status_atendimento();

COMMENT ON TABLE public.levantamento_item_status_historico IS
  'LEGADO — histórico de levantamento_itens.status_atendimento (coluna removida em 20260711). '
  'Dados históricos preservados para auditoria. '
  'NÃO inserir novos registros. Novas transições de foco → foco_risco_historico (append-only). '
  'Triggers dropados em A01/A06 (20260911000000/20260911020000). '
  'Funções dropadas em FIX-03 (20260913000002) e CLEANUP-02 (20260914000001).';
