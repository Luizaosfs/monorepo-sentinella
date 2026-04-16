-- Adiciona suporte a identificação de larvas por IA nos depósitos de vistoria
-- Coluna JSONB para armazenar resultado da Edge Function identify-larva

ALTER TABLE vistoria_depositos
  ADD COLUMN IF NOT EXISTS ia_identificacao jsonb DEFAULT NULL;

COMMENT ON COLUMN vistoria_depositos.ia_identificacao IS
  'Resultado da identificação de larvas por IA. Formato: { identified: bool, confidence: float, classe: string, image_url: string }';

-- Índice parcial para buscar depósitos com larva identificada por IA
CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_ia_identified
  ON vistoria_depositos ((ia_identificacao->>'identified'))
  WHERE ia_identificacao IS NOT NULL;
