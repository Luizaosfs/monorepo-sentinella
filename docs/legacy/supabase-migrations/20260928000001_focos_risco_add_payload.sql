-- Adiciona coluna payload a focos_risco
-- Usada pelo canal cidadão para armazenar foto_url, foto_public_id,
-- confirmacoes e outros metadados sem coluna dedicada.

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.focos_risco.payload IS
  'Metadados extras por origem_tipo. Ex: {foto_url, foto_public_id, confirmacoes, fonte} para origem=cidadao.';
