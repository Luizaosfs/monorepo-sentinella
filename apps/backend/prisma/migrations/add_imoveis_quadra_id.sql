-- FASE 1: Adiciona quadra_id (UUID) em imoveis com FK para bairros_quadras
-- Executar manualmente com: psql -f prisma/migrations/add_imoveis_quadra_id.sql

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS quadra_id uuid NULL;

ALTER TABLE imoveis
  ADD CONSTRAINT IF NOT EXISTS fk_imoveis_quadra
    FOREIGN KEY (quadra_id)
    REFERENCES bairros_quadras(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_quadra_id
  ON imoveis(quadra_id)
  WHERE quadra_id IS NOT NULL;
