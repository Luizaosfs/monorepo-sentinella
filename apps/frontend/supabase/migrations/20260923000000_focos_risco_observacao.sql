-- Migration: 20260923000000
-- Adiciona campo observacao em focos_risco para substituir o no-op
-- de api.itens.updateObservacaoAtendimento (removido de levantamento_itens na 20260711).

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS observacao text;

COMMENT ON COLUMN public.focos_risco.observacao IS
  'Observação livre do operador sobre o atendimento do foco. '
  'Persistida via api.itens.updateObservacaoAtendimento (busca foco por origem_levantamento_item_id) '
  'ou diretamente via api.focosRisco.update.';
