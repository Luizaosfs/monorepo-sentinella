-- Melhorias no registro de depósitos de vistoria de campo
-- Adiciona campos: qtd_com_agua, eliminado, vedado, ia_identificacao

ALTER TABLE vistoria_depositos
  ADD COLUMN IF NOT EXISTS qtd_com_agua     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eliminado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vedado           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_identificacao jsonb   DEFAULT NULL;

-- Backfill para dados legados:
-- 1) garante qtd_com_agua >= qtd_com_focos (senão viola chk_deposito_focos_agua)
-- 2) garante qtd_com_agua <= qtd_inspecionados (senão viola chk_deposito_agua_inspecionados)
UPDATE vistoria_depositos
SET qtd_com_agua = LEAST(
  COALESCE(qtd_inspecionados, 0),
  GREATEST(COALESCE(qtd_com_agua, 0), COALESCE(qtd_com_focos, 0))
);

-- Constraints: água ≤ inspecionados; focos ≤ água
ALTER TABLE vistoria_depositos
  DROP CONSTRAINT IF EXISTS chk_deposito_agua_inspecionados,
  ADD  CONSTRAINT chk_deposito_agua_inspecionados
    CHECK (qtd_com_agua <= qtd_inspecionados);

ALTER TABLE vistoria_depositos
  DROP CONSTRAINT IF EXISTS chk_deposito_focos_agua,
  ADD  CONSTRAINT chk_deposito_focos_agua
    CHECK (qtd_com_focos <= qtd_com_agua);

COMMENT ON COLUMN vistoria_depositos.qtd_com_agua IS
  'Quantidade de depósitos do tipo com água parada (≤ qtd_inspecionados)';
COMMENT ON COLUMN vistoria_depositos.eliminado IS
  'O depósito foi eliminado/destruído durante a vistoria';
COMMENT ON COLUMN vistoria_depositos.vedado IS
  'O depósito foi vedado/tampado durante a vistoria';
COMMENT ON COLUMN vistoria_depositos.ia_identificacao IS
  'Resultado da identificação de larvas por IA (Edge Function identify-larva)';

-- Também adicionar campo origem_visita em vistorias (payload_extra pode ser usado,
-- mas adicionamos coluna dedicada para facilitar queries)
ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS origem_visita text
    CHECK (origem_visita IN ('denuncia', 'liraa', 'drone')),
  ADD COLUMN IF NOT EXISTS habitat_selecionado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condicao_habitat text
    CHECK (condicao_habitat IN ('seco', 'agua_parada', 'inundado'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assinatura_responsavel_url text DEFAULT NULL;

COMMENT ON COLUMN vistorias.origem_visita IS
  'Origem da visita registrada na etapa pré-vistoria: denuncia, liraa, drone';
