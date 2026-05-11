-- FASE 2: Backfill de quadra_id em imoveis usando o codigo de quarteirao
-- Só preenche quando há exatamente UMA quadra com aquele código no cliente (sem ambiguidade).
-- Executar após add_imoveis_quadra_id.sql com: psql -f prisma/migrations/backfill_imoveis_quadra_id.sql

WITH matches AS (
  SELECT
    i.id                                            AS imovel_id,
    q.id                                            AS quadra_id,
    COUNT(q.id) OVER (PARTITION BY i.id)::int       AS match_count
  FROM imoveis i
  JOIN bairros_quadras q
    ON q.cliente_id = i.cliente_id
   AND q.codigo     = i.quarteirao
   AND q.deleted_at IS NULL
  WHERE i.quadra_id    IS NULL
    AND i.quarteirao   IS NOT NULL
    AND i.quarteirao   <> ''
    AND i.deleted_at   IS NULL
)
UPDATE imoveis i
   SET quadra_id = m.quadra_id
  FROM matches m
 WHERE i.id           = m.imovel_id
   AND m.match_count  = 1;
