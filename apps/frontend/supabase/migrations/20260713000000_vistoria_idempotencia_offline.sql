-- QW-05 Correção 1 + Correção 2: Idempotência offline + sinalização de pendências
--
-- Correção 1: índice UNIQUE evita vistorias duplicadas criadas por retry offline.
--             O drainQueue() trata o erro 23505 como "já processado" e remove da fila.
--
-- Correção 2: colunas pendente_assinatura / pendente_foto sinalizam vistorias enviadas
--             sem evidência (assinatura ou foto de imóvel sem acesso) por causa do modo offline.
--             O operador é alertado ao reconectar para completar antes de encerrar o turno.

-- ── Correção 2: colunas de pendência ─────────────────────────────────────────

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS pendente_assinatura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendente_foto       boolean NOT NULL DEFAULT false;

-- ── Correção 1: índice UNIQUE para idempotência offline ──────────────────────
-- Garante que a mesma vistoria (mesmo imóvel, agente, ciclo e data) não possa
-- ser inserida duas vezes, mesmo que o drain seja executado mais de uma vez.
-- Caso a tabela já tenha duplicatas, o index creation falhará; investigue antes
-- de aplicar em produção com: SELECT imovel_id, agente_id, ciclo, data_visita,
--   COUNT(*) FROM vistorias GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vistoria_imovel_agente_ciclo_data
  ON vistorias (imovel_id, agente_id, ciclo, data_visita);
