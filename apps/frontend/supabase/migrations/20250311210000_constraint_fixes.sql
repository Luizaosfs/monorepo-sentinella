-- =============================================================================
-- Fix de constraints ausentes ou incompletas
--
-- Estas alterações são idempotentes (IF NOT EXISTS / verificação manual).
-- Corrigem casos onde CREATE TABLE IF NOT EXISTS foi no-op porque a tabela
-- já existia, deixando UNIQUE constraints e FKs para trás.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sla_config_regiao — UNIQUE(cliente_id, regiao_id)
--    Necessário para upsert com onConflict: 'cliente_id,regiao_id'
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'sla_config_regiao'
      AND c.contype = 'u'
      AND c.conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'cliente_id')::smallint,
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'regiao_id')::smallint
      ]
  ) THEN
    ALTER TABLE public.sla_config_regiao
      ADD CONSTRAINT sla_config_regiao_cliente_id_regiao_id_key
      UNIQUE (cliente_id, regiao_id);
    RAISE NOTICE 'sla_config_regiao: UNIQUE(cliente_id, regiao_id) adicionado.';
  ELSE
    RAISE NOTICE 'sla_config_regiao: UNIQUE(cliente_id, regiao_id) já existe, ignorando.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. sla_config_regiao — FK cliente_id com ON DELETE CASCADE
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  -- Verifica se FK existe mas sem CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sla_config_regiao'
      AND rc.constraint_name = 'sla_config_regiao_cliente_id_fkey'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.sla_config_regiao
      DROP CONSTRAINT sla_config_regiao_cliente_id_fkey;
    ALTER TABLE public.sla_config_regiao
      ADD CONSTRAINT sla_config_regiao_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    RAISE NOTICE 'sla_config_regiao: FK cliente_id atualizada para ON DELETE CASCADE.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. sla_config_regiao — FK regiao_id com ON DELETE CASCADE
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sla_config_regiao'
      AND rc.constraint_name = 'sla_config_regiao_regiao_id_fkey'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.sla_config_regiao
      DROP CONSTRAINT sla_config_regiao_regiao_id_fkey;
    ALTER TABLE public.sla_config_regiao
      ADD CONSTRAINT sla_config_regiao_regiao_id_fkey
      FOREIGN KEY (regiao_id) REFERENCES public.regioes(id) ON DELETE CASCADE;
    RAISE NOTICE 'sla_config_regiao: FK regiao_id atualizada para ON DELETE CASCADE.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. sla_feriados — UNIQUE(cliente_id, data)
--    Evita feriados duplicados para o mesmo cliente no mesmo dia
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'sla_feriados'
      AND c.contype = 'u'
      AND c.conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'cliente_id')::smallint,
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'data')::smallint
      ]
  ) THEN
    ALTER TABLE public.sla_feriados
      ADD CONSTRAINT sla_feriados_cliente_id_data_key
      UNIQUE (cliente_id, data);
    RAISE NOTICE 'sla_feriados: UNIQUE(cliente_id, data) adicionado.';
  ELSE
    RAISE NOTICE 'sla_feriados: UNIQUE(cliente_id, data) já existe, ignorando.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. levantamento_item_status_historico — FK cliente_id → clientes
--    Garante integridade referencial; cliente_id é usado para RLS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'levantamento_item_status_historico'
      AND constraint_name = 'levantamento_item_status_historico_cliente_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.levantamento_item_status_historico
      ADD CONSTRAINT levantamento_item_status_historico_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
    RAISE NOTICE 'levantamento_item_status_historico: FK cliente_id adicionada.';
  ELSE
    RAISE NOTICE 'levantamento_item_status_historico: FK cliente_id já existe, ignorando.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Índice de suporte para sla_config_regiao (caso não exista)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sla_config_regiao_cliente_idx
  ON public.sla_config_regiao (cliente_id);

CREATE INDEX IF NOT EXISTS sla_config_regiao_regiao_idx
  ON public.sla_config_regiao (regiao_id);
