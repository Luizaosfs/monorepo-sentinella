-- Rollback da Fase C.6 — Seeds on Cliente Insert
--
-- Esta fase NÃO recriou os 7 triggers SQL legados — em vez disso,
-- portou para o use-case TS `SeedClienteNovo` invocado dentro do
-- $transaction de `CreateCliente`. O rollback abaixo é destinado APENAS
-- a desfazer as constraints/defaults adicionadas pela migration
-- `prisma/migrations/c6_seeds_uniques.sql` em caso de incidente.
--
-- ATENÇÃO: rodar este script em produção DESLIGA a idempotência dos
-- seeds (queda de UNIQUE) — só usar em rollback emergencial após
-- também reverter o código (`git revert`).
--
-- Para reverter o uso do SeedClienteNovo: basta `git revert` dos
-- arquivos da Fase C.6 — não há triggers SQL para recriar.
--
-- Aplicar:
--   psql "$DATABASE_URL" -f apps/backend/scripts/rollback-fase-C6.sql

BEGIN;

-- 1) cliente_plano
ALTER TABLE cliente_plano
  DROP CONSTRAINT IF EXISTS cliente_plano_cliente_id_key;

-- 2) cliente_quotas
ALTER TABLE cliente_quotas
  DROP CONSTRAINT IF EXISTS cliente_quotas_cliente_id_key;

-- 3) sentinela_drone_risk_config
ALTER TABLE sentinela_drone_risk_config
  DROP CONSTRAINT IF EXISTS sentinela_drone_risk_config_cliente_id_key;

-- 4) sla_foco_config
ALTER TABLE sla_foco_config
  DROP CONSTRAINT IF EXISTS sla_foco_config_cliente_id_fase_key;
ALTER TABLE sla_foco_config
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

-- 5) sla_feriados
ALTER TABLE sla_feriados
  DROP CONSTRAINT IF EXISTS sla_feriados_cliente_id_data_key;
ALTER TABLE sla_feriados
  ALTER COLUMN created_at DROP DEFAULT;

-- 6) sentinela_yolo_class_config
ALTER TABLE sentinela_yolo_class_config
  DROP CONSTRAINT IF EXISTS sentinela_yolo_class_config_cliente_id_item_key_key;

-- 7) sentinela_yolo_synonym
ALTER TABLE sentinela_yolo_synonym
  DROP CONSTRAINT IF EXISTS sentinela_yolo_synonym_cliente_id_synonym_key;

COMMIT;
