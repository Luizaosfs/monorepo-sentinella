-- =============================================================================
-- E.1.1 — Hardening arquitetural do fluxo epidemiológico-operacional
-- Aplicar com: psql -f prisma/migrations/e1_1_hardening_epidemiologico.sql
-- =============================================================================

-- 1. Vínculo operacional principal em casos_notificados
-- -----------------------------------------------------------------------------
ALTER TABLE casos_notificados
  ADD COLUMN IF NOT EXISTS foco_risco_id                 uuid REFERENCES focos_risco(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS foco_vinculado_em             timestamptz,
  ADD COLUMN IF NOT EXISTS foco_vinculo_tipo             text,
  ADD COLUMN IF NOT EXISTS foco_vinculo_distancia_metros double precision;

-- Valores esperados de foco_vinculo_tipo:
--   'existente_300m'          — foco pré-existente absorveu o caso
--   'criado_por_caso'         — caso gerou novo foco epidemiológico
--   'pendente_geocodificacao' — sem lat/lng; caso rastreável mas sem ação possível

CREATE INDEX IF NOT EXISTS casos_notificados_foco_risco_id_idx
  ON casos_notificados (foco_risco_id)
  WHERE foco_risco_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS casos_notificados_foco_vinculo_tipo_idx
  ON casos_notificados (cliente_id, foco_vinculo_tipo)
  WHERE foco_vinculo_tipo IS NOT NULL;

-- 2. CHECK constraint de origem_tipo em focos_risco (adiciona 'caso_notificado')
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Remove constraint antiga se existir (para recriar com valor novo)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'focos_risco'
      AND constraint_name = 'focos_risco_origem_tipo_check'
      AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE focos_risco DROP CONSTRAINT focos_risco_origem_tipo_check;
  END IF;

  ALTER TABLE focos_risco ADD CONSTRAINT focos_risco_origem_tipo_check
    CHECK (origem_tipo IN ('cidadao', 'drone', 'agente', 'manual', 'caso_notificado'));
END $$;

-- 3. Redesenho de caso_foco_cruzamento: foco_risco_id direto (dedupe ampla)
-- -----------------------------------------------------------------------------
-- 3a. Adicionar foco_risco_id (temporariamente nullable para migração dos dados)
ALTER TABLE caso_foco_cruzamento
  ADD COLUMN IF NOT EXISTS foco_risco_id uuid;

-- 3b. Popular foco_risco_id a partir do JOIN via levantamento_item_id (dados históricos)
UPDATE caso_foco_cruzamento cfc
SET foco_risco_id = fr.id
FROM focos_risco fr
WHERE fr.origem_levantamento_item_id = cfc.levantamento_item_id
  AND fr.deleted_at IS NULL
  AND cfc.foco_risco_id IS NULL;

-- 3c. Remover linhas órfãs (cruzamentos sem foco rastreável — raro em produção)
DELETE FROM caso_foco_cruzamento WHERE foco_risco_id IS NULL;

-- 3d. Tornar NOT NULL e adicionar FK com CASCADE
ALTER TABLE caso_foco_cruzamento
  ALTER COLUMN foco_risco_id SET NOT NULL;

ALTER TABLE caso_foco_cruzamento
  ADD CONSTRAINT caso_foco_cruzamento_foco_risco_id_fkey
  FOREIGN KEY (foco_risco_id) REFERENCES focos_risco(id) ON DELETE CASCADE;

-- 3e. Trocar unique key: (caso_id, levantamento_item_id) → (caso_id, foco_risco_id)
-- Nota: o índice legado foi criado como CREATE UNIQUE INDEX (não como CONSTRAINT),
-- por isso requer DROP INDEX — DROP CONSTRAINT não o remove.
DROP INDEX IF EXISTS caso_foco_cruzamento_caso_id_levantamento_item_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS caso_foco_cruzamento_caso_foco_uq
  ON caso_foco_cruzamento (caso_id, foco_risco_id);

-- 3f. levantamento_item_id torna-se campo auxiliar opcional
ALTER TABLE caso_foco_cruzamento
  ALTER COLUMN levantamento_item_id DROP NOT NULL;

-- 3g. Índice auxiliar para lookup por foco
CREATE INDEX IF NOT EXISTS caso_foco_cruzamento_foco_risco_id_idx
  ON caso_foco_cruzamento (foco_risco_id);
