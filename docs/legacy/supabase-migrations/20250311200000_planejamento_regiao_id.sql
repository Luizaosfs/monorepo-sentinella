-- =============================================================================
-- Adiciona regiao_id em planejamento
--
-- Vínculo opcional com regioes — permite que SLA configs por região sejam
-- resolvidas automaticamente ao criar itens via criar_levantamento_item_manual
-- e ao gerar SLAs automáticos via trigger.
-- =============================================================================

ALTER TABLE public.planejamento
  ADD COLUMN IF NOT EXISTS regiao_id uuid REFERENCES public.regioes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planejamento.regiao_id IS
  'Região associada ao planejamento. Usada para resolver sla_config_regiao '
  '(override de SLA por região) e para agrupamento geográfico no painel.';

CREATE INDEX IF NOT EXISTS planejamento_regiao_id_idx
  ON public.planejamento (regiao_id)
  WHERE regiao_id IS NOT NULL;
