-- =============================================================================
-- OBSERVAÇÃO DO ATENDIMENTO (por item)
-- Campo para texto digitado ou transcrito do microfone no painel de detalhes.
-- =============================================================================

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS observacao_atendimento text;

COMMENT ON COLUMN public.levantamento_itens.observacao_atendimento IS
  'Observação do atendimento: digitada ou transcrita pelo microfone (painel de detalhes do item).';
