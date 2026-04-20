-- =============================================================================
-- STATUS DO ATENDIMENTO, AÇÃO APLICADA E DATA DE RESOLUÇÃO
-- Fecha o ciclo do item: pendente → em_atendimento → resolvido
-- =============================================================================

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS status_atendimento text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS acao_aplicada text,
  ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone;

-- Constraint para valores válidos
ALTER TABLE public.levantamento_itens
  DROP CONSTRAINT IF EXISTS levantamento_itens_status_atendimento_check;
ALTER TABLE public.levantamento_itens
  ADD CONSTRAINT levantamento_itens_status_atendimento_check
  CHECK (status_atendimento IN ('pendente', 'em_atendimento', 'resolvido'));

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS ix_levantamento_itens_status_atendimento
  ON public.levantamento_itens(status_atendimento);

COMMENT ON COLUMN public.levantamento_itens.status_atendimento IS
  'Ciclo de vida do item: pendente (padrão) → em_atendimento → resolvido.';
COMMENT ON COLUMN public.levantamento_itens.acao_aplicada IS
  'O que o operador efetivamente fez no local (diferente de acao, que é a ação recomendada pelo sistema).';
COMMENT ON COLUMN public.levantamento_itens.data_resolucao IS
  'Timestamp de quando o item foi marcado como resolvido pelo operador.';
