-- Fase C.6 — Seeds on Cliente Insert
-- Adiciona uniques e defaults necessários para que o use-case SeedClienteNovo
-- possa usar upsert / createMany skipDuplicates / inserts mínimos com paridade
-- ao comportamento dos triggers SQL legados do Supabase.
--
-- Aplicar em produção:
--   psql "$DATABASE_URL" -f apps/backend/prisma/migrations/c6_seeds_uniques.sql
--
-- Cada bloco aborta se houver duplicatas que impediriam a criação da constraint.

BEGIN;

-- ============================================================================
-- 1) cliente_plano.cliente_id UNIQUE
-- Cada cliente tem 1 plano ativo (legado: ON CONFLICT (cliente_id))
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id FROM cliente_plano
    GROUP BY cliente_id HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'cliente_plano: % cliente_id duplicados — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE cliente_plano
  ADD CONSTRAINT cliente_plano_cliente_id_key UNIQUE (cliente_id);

-- ============================================================================
-- 2) cliente_quotas.cliente_id UNIQUE
-- 1 linha de quotas por cliente (legado: ON CONFLICT (cliente_id))
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id FROM cliente_quotas
    GROUP BY cliente_id HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'cliente_quotas: % cliente_id duplicados — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE cliente_quotas
  ADD CONSTRAINT cliente_quotas_cliente_id_key UNIQUE (cliente_id);

-- ============================================================================
-- 3) sentinela_drone_risk_config.cliente_id UNIQUE
-- 1 config de drone por cliente (legado: ON CONFLICT (cliente_id))
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id FROM sentinela_drone_risk_config
    GROUP BY cliente_id HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'sentinela_drone_risk_config: % cliente_id duplicados — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE sentinela_drone_risk_config
  ADD CONSTRAINT sentinela_drone_risk_config_cliente_id_key UNIQUE (cliente_id);

-- ============================================================================
-- 4) sla_foco_config: UNIQUE(cliente_id, fase) + DEFAULT now() em created_at/updated_at
-- 4 fases por cliente: triagem, inspecao, confirmacao, tratamento
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id, fase FROM sla_foco_config
    GROUP BY cliente_id, fase HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'sla_foco_config: % tuplas (cliente_id, fase) duplicadas — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE sla_foco_config
  ADD CONSTRAINT sla_foco_config_cliente_id_fase_key UNIQUE (cliente_id, fase);

ALTER TABLE sla_foco_config
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- ============================================================================
-- 5) sla_feriados: UNIQUE(cliente_id, data) + DEFAULT now() em created_at
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id, data FROM sla_feriados
    GROUP BY cliente_id, data HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'sla_feriados: % tuplas (cliente_id, data) duplicadas — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE sla_feriados
  ADD CONSTRAINT sla_feriados_cliente_id_data_key UNIQUE (cliente_id, data);

ALTER TABLE sla_feriados
  ALTER COLUMN created_at SET DEFAULT now();

-- ============================================================================
-- 6) sentinela_yolo_class_config: UNIQUE(cliente_id, item_key)
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id, item_key FROM sentinela_yolo_class_config
    GROUP BY cliente_id, item_key HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'sentinela_yolo_class_config: % tuplas (cliente_id, item_key) duplicadas — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE sentinela_yolo_class_config
  ADD CONSTRAINT sentinela_yolo_class_config_cliente_id_item_key_key UNIQUE (cliente_id, item_key);

-- ============================================================================
-- 7) sentinela_yolo_synonym: UNIQUE(cliente_id, synonym)
-- ============================================================================
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id, synonym FROM sentinela_yolo_synonym
    GROUP BY cliente_id, synonym HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'sentinela_yolo_synonym: % tuplas (cliente_id, synonym) duplicadas — resolver antes de aplicar UNIQUE', dup_count;
  END IF;
END $$;

ALTER TABLE sentinela_yolo_synonym
  ADD CONSTRAINT sentinela_yolo_synonym_cliente_id_synonym_key UNIQUE (cliente_id, synonym);

COMMIT;
