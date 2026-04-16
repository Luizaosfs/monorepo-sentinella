-- =============================================================================
-- 1D: Remover trigger e função fn_validar_resolucao_item
--
-- Problema: fn_validar_resolucao_item() (criada em 20260602000000) referencia
-- NEW.status_atendimento e NEW.acao_aplicada — colunas removidas em
-- 20260711000000_drop_deprecated_levantamento_itens_cols.sql.
-- Qualquer UPDATE em levantamento_itens dispara EXCEPTION no banco.
--
-- Fix: dropar o trigger e a função. A validação de resolução de focos
-- é feita exclusivamente por rpc_transicionar_foco_risco() no aggregate root.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_validar_resolucao_item ON levantamento_itens;
DROP FUNCTION IF EXISTS fn_validar_resolucao_item();

COMMENT ON TABLE levantamento_itens IS
  'Itens de levantamento (drone ou manual). '
  'Gestão de estado e resolução feita exclusivamente via focos_risco + rpc_transicionar_foco_risco(). '
  'Fix 1D (20260800030000): removidos trigger/fn_validar_resolucao_item que referenciavam colunas dropadas.';
