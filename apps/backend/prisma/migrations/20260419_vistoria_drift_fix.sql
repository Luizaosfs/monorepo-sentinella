-- =============================================================================
-- Migration: 20260419_vistoria_drift_fix.sql
--
-- Objetivo: Resolver drift Tipo B entre schema Prisma e banco PostgreSQL em
--           4 tabelas de vistoria (sub-tabelas de vistorias).
--
-- Contexto: Durante a migração Supabase → NestJS, o schema Prisma foi
--           adicionado com colunas novas (estrutura normalizada de booleanos),
--           mas o banco PostgreSQL manteve as colunas legadas do Supabase.
--           Esta migration ADD as novas, migra os dados recuperáveis e DROP
--           as colunas velhas.
--
-- Registros existentes:
--   vistoria_depositos : 80  linhas (80 com `quantidade` preenchida)
--   vistoria_sintomas  : 27  linhas (dados legados 100% vazios)
--   vistoria_riscos    : 19  linhas (dados legados 100% vazios)
--   vistoria_calhas    : 12  linhas (dados legados 100% vazios)
--   TOTAL              : 138 linhas
--
-- Ordem de operações por tabela:
--   a) ADD COLUMN IF NOT EXISTS das colunas novas
--   b) UPDATE cliente_id via JOIN com vistorias (multitenancy)
--   c) UPDATE de migração de dados (apenas vistoria_depositos)
--   d) Verificação de integridade (RAISE EXCEPTION se cliente_id NULL)
--   e) ALTER COLUMN cliente_id SET NOT NULL
--   f) DROP COLUMN IF EXISTS das colunas legadas
--
-- Aplicar em staging primeiro. Validar com COUNT(*) pré e pós.
-- Testar POST /vistorias/completa antes de aplicar em produção.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA 1: vistoria_depositos
-- Banco atual : id, vistoria_id, created_at, eliminado, com_larva, foto_url,
--               observacao, quantidade, tipo_deposito, tratado
-- Após       : id, vistoria_id, created_at, eliminado, tipo,
--               qtd_inspecionados, qtd_com_focos, qtd_eliminados,
--               usou_larvicida, qtd_larvicida_g, qtd_com_agua, vedado,
--               ia_identificacao, deleted_at, cliente_id
-- Dados migrados: quantidade → qtd_inspecionados (80 linhas)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Adicionar colunas novas (IF NOT EXISTS — idempotente)
--     Nota: `eliminado` já existe no banco — IF NOT EXISTS é no-op seguro.
ALTER TABLE vistoria_depositos
  ADD COLUMN IF NOT EXISTS tipo              text             NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qtd_inspecionados integer          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_com_focos     integer          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_eliminados    integer          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usou_larvicida    boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qtd_larvicida_g   double precision,
  ADD COLUMN IF NOT EXISTS qtd_com_agua      integer          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eliminado         boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vedado            boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_identificacao  jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at        timestamptz,
  -- cliente_id sem NOT NULL aqui; SET NOT NULL aplicado após UPDATE abaixo
  ADD COLUMN IF NOT EXISTS cliente_id        uuid;

-- 1b. Popular cliente_id recuperando do registro pai em vistorias
UPDATE vistoria_depositos vd
SET    cliente_id = v.cliente_id
FROM   vistorias v
WHERE  vd.vistoria_id = v.id
  AND  vd.cliente_id IS NULL;

-- 1c. Migrar dados de quantidade → qtd_inspecionados (único campo com dados)
--     Executado dentro de DO para verificar se a coluna legada ainda existe
--     (garante idempotência na segunda execução pós-DROP)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'vistoria_depositos'
       AND column_name  = 'quantidade'
  ) THEN
    -- 80 linhas com quantidade preenchida — preservar em qtd_inspecionados
    UPDATE vistoria_depositos
    SET    qtd_inspecionados = COALESCE(quantidade, 0)
    WHERE  quantidade IS NOT NULL
      AND  quantidade <> 0;

    RAISE NOTICE 'vistoria_depositos: quantidade migrada para qtd_inspecionados.';
  ELSE
    RAISE NOTICE 'vistoria_depositos: coluna quantidade já removida — migração de dados ignorada.';
  END IF;
END $$;

-- 1d. Verificação de integridade: abortar se qualquer registro ficou sem cliente_id
DO $$
DECLARE v_null_count integer;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM   vistoria_depositos
  WHERE  cliente_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION
      'ABORT: vistoria_depositos tem % registro(s) com cliente_id NULL. '
      'Verifique registros órfãos (vistoria_id sem correspondência em vistorias) '
      'antes de continuar.', v_null_count;
  END IF;

  RAISE NOTICE 'vistoria_depositos: integridade OK — cliente_id preenchido em todos os registros.';
END $$;

-- 1e. Aplicar NOT NULL em cliente_id (seguro após UPDATE acima)
ALTER TABLE vistoria_depositos
  ALTER COLUMN cliente_id SET NOT NULL;

-- 1f. Remover colunas legadas (dados confirmados: sem conteúdo relevante exceto quantidade, já migrada)
ALTER TABLE vistoria_depositos
  DROP COLUMN IF EXISTS tipo_deposito,
  DROP COLUMN IF EXISTS quantidade,
  DROP COLUMN IF EXISTS com_larva,
  DROP COLUMN IF EXISTS tratado,
  DROP COLUMN IF EXISTS observacao,
  DROP COLUMN IF EXISTS foto_url;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA 2: vistoria_sintomas
-- Banco atual : id, vistoria_id, created_at, observacao, sintoma
-- Após        : id, vistoria_id, created_at, cliente_id, febre,
--               manchas_vermelhas, dor_articulacoes, dor_cabeca,
--               moradores_sintomas_qtd, gerou_caso_notificado_id, deleted_at
-- Dados migrados: NENHUM (observacao e sintoma confirmados 100% vazios)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Adicionar colunas novas
ALTER TABLE vistoria_sintomas
  -- cliente_id sem NOT NULL aqui; SET NOT NULL aplicado após UPDATE abaixo
  ADD COLUMN IF NOT EXISTS cliente_id              uuid,
  ADD COLUMN IF NOT EXISTS febre                   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manchas_vermelhas       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dor_articulacoes        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dor_cabeca              boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moradores_sintomas_qtd  integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gerou_caso_notificado_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at              timestamptz;

-- 2b. Popular cliente_id via JOIN com vistorias
UPDATE vistoria_sintomas vs
SET    cliente_id = v.cliente_id
FROM   vistorias v
WHERE  vs.vistoria_id = v.id
  AND  vs.cliente_id IS NULL;

-- 2c. Verificação de integridade
DO $$
DECLARE v_null_count integer;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM   vistoria_sintomas
  WHERE  cliente_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION
      'ABORT: vistoria_sintomas tem % registro(s) com cliente_id NULL. '
      'Verifique registros órfãos antes de continuar.', v_null_count;
  END IF;

  RAISE NOTICE 'vistoria_sintomas: integridade OK — cliente_id preenchido em todos os registros.';
END $$;

-- 2d. Aplicar NOT NULL em cliente_id
ALTER TABLE vistoria_sintomas
  ALTER COLUMN cliente_id SET NOT NULL;

-- 2e. Remover colunas legadas (dados confirmados 100% vazios — sem perda)
ALTER TABLE vistoria_sintomas
  DROP COLUMN IF EXISTS sintoma,
  DROP COLUMN IF EXISTS observacao;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA 3: vistoria_riscos
-- Banco atual : id, vistoria_id, created_at, descricao, tipo_risco
-- Após        : id, vistoria_id, created_at, cliente_id, menor_incapaz,
--               idoso_incapaz, dep_quimico, risco_alimentar, risco_moradia,
--               criadouro_animais, lixo, residuos_organicos, residuos_quimicos,
--               residuos_medicos, acumulo_material_organico, animais_sinais_lv,
--               caixa_destampada, outro_risco_vetorial, deleted_at
-- Dados migrados: NENHUM (descricao e tipo_risco confirmados 100% vazios)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Adicionar colunas novas
ALTER TABLE vistoria_riscos
  -- cliente_id sem NOT NULL aqui; SET NOT NULL aplicado após UPDATE abaixo
  ADD COLUMN IF NOT EXISTS cliente_id               uuid,
  ADD COLUMN IF NOT EXISTS menor_incapaz             boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idoso_incapaz             boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dep_quimico               boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risco_alimentar           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risco_moradia             boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criadouro_animais         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lixo                      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS residuos_organicos        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS residuos_quimicos         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS residuos_medicos          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acumulo_material_organico boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS animais_sinais_lv         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS caixa_destampada          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outro_risco_vetorial      text,
  ADD COLUMN IF NOT EXISTS deleted_at               timestamptz;

-- 3b. Popular cliente_id via JOIN com vistorias
UPDATE vistoria_riscos vr
SET    cliente_id = v.cliente_id
FROM   vistorias v
WHERE  vr.vistoria_id = v.id
  AND  vr.cliente_id IS NULL;

-- 3c. Verificação de integridade
DO $$
DECLARE v_null_count integer;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM   vistoria_riscos
  WHERE  cliente_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION
      'ABORT: vistoria_riscos tem % registro(s) com cliente_id NULL. '
      'Verifique registros órfãos antes de continuar.', v_null_count;
  END IF;

  RAISE NOTICE 'vistoria_riscos: integridade OK — cliente_id preenchido em todos os registros.';
END $$;

-- 3d. Aplicar NOT NULL em cliente_id
ALTER TABLE vistoria_riscos
  ALTER COLUMN cliente_id SET NOT NULL;

-- 3e. Remover colunas legadas (dados confirmados 100% vazios — sem perda)
ALTER TABLE vistoria_riscos
  DROP COLUMN IF EXISTS tipo_risco,
  DROP COLUMN IF EXISTS descricao;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA 4: vistoria_calhas
-- Banco atual : id, vistoria_id, created_at, observacao, com_acumulo,
--               estado, tipo
-- Após        : id, vistoria_id, created_at, cliente_id, posicao, condicao,
--               com_foco, acessivel, tratamento_realizado, foto_url,
--               observacao, foto_public_id, deleted_at
-- Dados migrados: NENHUM (todos os campos velhos confirmados vazios)
-- ATENÇÃO: `observacao` existe no schema legado E no novo — NÃO fazer DROP
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Adicionar colunas novas
--     posicao/condicao: NOT NULL sem @default no Prisma — DEFAULT '' garante
--     que as 12 linhas legadas não violem a constraint; o application code
--     preencherá valores reais em novas inserções.
ALTER TABLE vistoria_calhas
  -- cliente_id sem NOT NULL aqui; SET NOT NULL aplicado após UPDATE abaixo
  ADD COLUMN IF NOT EXISTS cliente_id           uuid,
  ADD COLUMN IF NOT EXISTS posicao              text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS condicao             text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS com_foco             boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acessivel            boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tratamento_realizado boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foto_url             text,
  -- observacao já existe como coluna legada; IF NOT EXISTS é no-op seguro
  ADD COLUMN IF NOT EXISTS observacao           text,
  ADD COLUMN IF NOT EXISTS foto_public_id       text,
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz;

-- 4b. Popular cliente_id via JOIN com vistorias
UPDATE vistoria_calhas vc
SET    cliente_id = v.cliente_id
FROM   vistorias v
WHERE  vc.vistoria_id = v.id
  AND  vc.cliente_id IS NULL;

-- 4c. Verificação de integridade
DO $$
DECLARE v_null_count integer;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM   vistoria_calhas
  WHERE  cliente_id IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION
      'ABORT: vistoria_calhas tem % registro(s) com cliente_id NULL. '
      'Verifique registros órfãos antes de continuar.', v_null_count;
  END IF;

  RAISE NOTICE 'vistoria_calhas: integridade OK — cliente_id preenchido em todos os registros.';
END $$;

-- 4d. Aplicar NOT NULL em cliente_id
ALTER TABLE vistoria_calhas
  ALTER COLUMN cliente_id SET NOT NULL;

-- 4e. Remover colunas legadas
--     NÃO dropa `observacao` — coluna existe no novo schema como nullable
ALTER TABLE vistoria_calhas
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS estado,
  DROP COLUMN IF EXISTS com_acumulo;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL GLOBAL
-- Última linha de defesa: aborta o COMMIT se qualquer tabela tiver NULL
-- em cliente_id após todos os passos acima.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dep integer;
  v_sin integer;
  v_ris integer;
  v_cal integer;
BEGIN
  SELECT COUNT(*) INTO v_dep FROM vistoria_depositos WHERE cliente_id IS NULL;
  SELECT COUNT(*) INTO v_sin FROM vistoria_sintomas   WHERE cliente_id IS NULL;
  SELECT COUNT(*) INTO v_ris FROM vistoria_riscos     WHERE cliente_id IS NULL;
  SELECT COUNT(*) INTO v_cal FROM vistoria_calhas     WHERE cliente_id IS NULL;

  IF (v_dep + v_sin + v_ris + v_cal) > 0 THEN
    RAISE EXCEPTION
      'ABORT verificação final global: cliente_id NULL detectado — '
      'depositos=%, sintomas=%, riscos=%, calhas=% — transaction rolled back.',
      v_dep, v_sin, v_ris, v_cal;
  END IF;

  RAISE NOTICE '=== VERIFICAÇÃO FINAL GLOBAL OK ===';
  RAISE NOTICE 'Todos os 138 registros têm cliente_id preenchido.';
  RAISE NOTICE 'vistoria_depositos: % registros', (SELECT COUNT(*) FROM vistoria_depositos);
  RAISE NOTICE 'vistoria_sintomas : % registros', (SELECT COUNT(*) FROM vistoria_sintomas);
  RAISE NOTICE 'vistoria_riscos   : % registros', (SELECT COUNT(*) FROM vistoria_riscos);
  RAISE NOTICE 'vistoria_calhas   : % registros', (SELECT COUNT(*) FROM vistoria_calhas);
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES
-- Prisma declara índices via @@index(...) mas `prisma generate` não os cria
-- no banco. Aplicamos aqui para garantir performance multitenant adequada.
-- CREATE INDEX IF NOT EXISTS — idempotente; não falha se já existir.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_vistoria_id
  ON vistoria_depositos (vistoria_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_cliente_id
  ON vistoria_depositos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_depositos_cliente_id_created_at
  ON vistoria_depositos (cliente_id, created_at);

CREATE INDEX IF NOT EXISTS idx_vistoria_sintomas_vistoria_id
  ON vistoria_sintomas (vistoria_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_sintomas_cliente_id
  ON vistoria_sintomas (cliente_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_riscos_vistoria_id
  ON vistoria_riscos (vistoria_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_riscos_cliente_id
  ON vistoria_riscos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_calhas_vistoria_id
  ON vistoria_calhas (vistoria_id);

CREATE INDEX IF NOT EXISTS idx_vistoria_calhas_cliente_id
  ON vistoria_calhas (cliente_id);


COMMIT;
