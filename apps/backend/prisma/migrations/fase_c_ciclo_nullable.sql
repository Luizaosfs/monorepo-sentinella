-- Fase C: distribuição territorial fixa — ciclo_id opcional em bairros_distribuicao
--
-- Permite dois tipos de registro:
--   1. Distribuição territorial atual  → ciclo_id IS NULL
--   2. Distribuição histórica/analítica → ciclo_id = UUID
--
-- Diagnóstico executado em 2026-05-11:
--   162 distribuições, 1 ciclo, 0 duplicatas, 0 registros com ciclo_id NULL
--   Migration segura para aplicar.

-- 1. Torna ciclo_id opcional (remove NOT NULL)
ALTER TABLE bairros_distribuicao
  ALTER COLUMN ciclo_id DROP NOT NULL;

-- 2. Partial unique index para distribuição territorial (ciclo_id IS NULL)
--    Garante: 1 agente responsável atual por quadra por cliente
--    Nota: a unique constraint existente (cliente_id, ciclo_id, quadra_id)
--    continua protegendo os registros históricos com ciclo_id NOT NULL,
--    pois NULLs são considerados distintos em UNIQUE constraints no PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bairros_distribuicao_territorial_atual
  ON bairros_distribuicao (cliente_id, quadra_id)
  WHERE ciclo_id IS NULL;
