-- =============================================================================
-- ROLLBACK — FASE C.1: SLA no fluxo de foco (Sentinella Backend)
-- =============================================================================
-- Esta fase portou 3 triggers do Supabase legado para use-cases TypeScript:
--   - fn_iniciar_sla_ao_confirmar_foco  → IniciarSlaAoConfirmarFoco
--   - fn_vincular_sla_ao_confirmar       → absorvido no use-case acima (passo 2)
--   - fn_fechar_sla_ao_resolver_foco     → FecharSlaAoResolverFoco
--   - sla_resolve_config (fn SQL)        → ResolveSlaConfig (use-case)
--
-- O efeito é em memória do NestJS (use-cases injetados em TransicionarFocoRisco).
-- Para reverter a Fase C.1 operacionalmente, basta `git revert` dos commits +
-- redeploy: o Transicionar volta ao fluxo pré-C.1 (sem criar/fechar SLA).
-- O banco fica inalterado — este script apenas DOCUMENTA o rollback em
-- `audit_log` e oferece, OPCIONALMENTE, a reconstituição dos triggers SQL
-- antigos (mantidos aqui como referência histórica).
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-C1.sql
--
-- ⚠️ Ler cada bloco e comentar os que NÃO quiser rodar.
-- =============================================================================

BEGIN;

-- ── 1. Documentar o rollback em audit_log ──────────────────────────────────
INSERT INTO public.audit_log (
  cliente_id,
  usuario_id,
  tabela,
  registro_id,
  dados_antes,
  dados_depois,
  operacao,
  created_at
)
VALUES (
  NULL,
  NULL,
  '__rollback_fase_C1__',
  NULL,
  NULL,
  jsonb_build_object(
    'motivo', 'Rollback operacional da Fase C.1 (SLA no fluxo de foco).',
    'aviso',  'Use-cases removidos via git revert + redeploy.',
    'escopo', jsonb_build_object(
      'iniciar_sla_ao_confirmar_foco', 'porte de fn_iniciar_sla_ao_confirmar_foco + fn_vincular_sla_ao_confirmar',
      'fechar_sla_ao_resolver_foco',   'porte de fn_fechar_sla_ao_resolver_foco',
      'resolve_sla_config',            'porte de sla_resolve_config'
    ),
    'compensacao', 'sla_erros_criacao grava erros fora da transação quando SLA hook falha',
    'data',        now()
  ),
  'ROLLBACK',
  now()
);

-- ── 2. (Opcional) Reconstituir triggers SQL pré-migração Supabase ──────────
-- Se quiser voltar ao comportamento de trigger SQL clássico, descomentar os
-- blocos abaixo. Eles replicam os triggers originais do Supabase de forma
-- aproximada — `auth.uid()` não existe no banco self-hosted, então os
-- registros ficam com `created_by = NULL` (perda aceita em caso de rollback).
--
-- -- fn_iniciar_sla_ao_confirmar_foco
-- CREATE OR REPLACE FUNCTION public.fn_iniciar_sla_ao_confirmar_foco()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- DECLARE
--   v_sla_horas int;
--   v_config    jsonb;
--   v_prio      text := COALESCE(NEW.prioridade, 'P3');
-- BEGIN
--   IF NEW.status = 'confirmado' AND (OLD.status IS DISTINCT FROM 'confirmado') THEN
--     -- Idempotência: se já existe SLA, sai.
--     IF EXISTS (SELECT 1 FROM sla_operacional WHERE foco_risco_id = NEW.id) THEN
--       RETURN NEW;
--     END IF;
--
--     -- Tenta vincular órfão antes de criar.
--     IF NEW.origem_levantamento_item_id IS NOT NULL THEN
--       UPDATE sla_operacional
--          SET foco_risco_id = NEW.id
--        WHERE levantamento_item_id = NEW.origem_levantamento_item_id
--          AND foco_risco_id IS NULL
--          AND deleted_at IS NULL;
--       IF FOUND THEN
--         RETURN NEW;
--       END IF;
--     END IF;
--
--     -- Resolve config: região → cliente → fallback.
--     SELECT public.sla_resolve_config(NEW.cliente_id, NEW.regiao_id, v_prio) INTO v_sla_horas;
--
--     INSERT INTO sla_operacional (
--       cliente_id, foco_risco_id, levantamento_item_id,
--       prioridade, sla_horas, inicio, prazo_final, status
--     )
--     VALUES (
--       NEW.cliente_id, NEW.id, NEW.origem_levantamento_item_id,
--       v_prio, v_sla_horas, now(), now() + (v_sla_horas || ' hours')::interval, 'pendente'
--     )
--     ON CONFLICT DO NOTHING;
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- fn_fechar_sla_ao_resolver_foco
-- CREATE OR REPLACE FUNCTION public.fn_fechar_sla_ao_resolver_foco()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- BEGIN
--   IF NEW.status IN ('resolvido', 'descartado')
--      AND OLD.status NOT IN ('resolvido', 'descartado') THEN
--     UPDATE sla_operacional
--        SET status = 'concluido',
--            concluido_em = now()
--      WHERE foco_risco_id = NEW.id
--        AND status IN ('pendente', 'em_atendimento')
--        AND deleted_at IS NULL;
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- sla_resolve_config (fn auxiliar usada pelos triggers acima)
-- CREATE OR REPLACE FUNCTION public.sla_resolve_config(
--   p_cliente_id uuid,
--   p_regiao_id  uuid,
--   p_prioridade text
-- ) RETURNS int LANGUAGE plpgsql AS $fn$
-- DECLARE
--   v_horas int;
-- BEGIN
--   IF p_regiao_id IS NOT NULL THEN
--     SELECT NULLIF((config ->> p_prioridade), '')::int INTO v_horas
--       FROM sla_config_regiao
--      WHERE cliente_id = p_cliente_id AND regiao_id = p_regiao_id
--      LIMIT 1;
--     IF v_horas IS NOT NULL AND v_horas > 0 THEN RETURN v_horas; END IF;
--   END IF;
--
--   SELECT NULLIF((config ->> p_prioridade), '')::int INTO v_horas
--     FROM sla_config
--    WHERE cliente_id = p_cliente_id
--    LIMIT 1;
--   IF v_horas IS NOT NULL AND v_horas > 0 THEN RETURN v_horas; END IF;
--
--   RETURN CASE p_prioridade
--     WHEN 'P1' THEN 4
--     WHEN 'P2' THEN 12
--     WHEN 'P3' THEN 24
--     WHEN 'P4' THEN 72
--     WHEN 'P5' THEN 168
--     ELSE 24
--   END;
-- END;
-- $fn$;
--
-- -- Triggers propriamente ditos
-- DROP TRIGGER IF EXISTS trg_iniciar_sla_ao_confirmar ON public.focos_risco;
-- CREATE TRIGGER trg_iniciar_sla_ao_confirmar
--   AFTER UPDATE OF status ON public.focos_risco
--   FOR EACH ROW EXECUTE FUNCTION public.fn_iniciar_sla_ao_confirmar_foco();
--
-- DROP TRIGGER IF EXISTS trg_fechar_sla_ao_resolver ON public.focos_risco;
-- CREATE TRIGGER trg_fechar_sla_ao_resolver
--   AFTER UPDATE OF status ON public.focos_risco
--   FOR EACH ROW EXECUTE FUNCTION public.fn_fechar_sla_ao_resolver_foco();

-- ── 3. (Opcional) Purgar SLAs criados automaticamente pela Fase C.1 ────────
-- A identificação exata depende do deploy — ajustar `created_at >= ...` para
-- a data/hora real de go-live da Fase C.1. NÃO rodar sem revisão.
--
-- DELETE FROM public.sla_operacional
--  WHERE foco_risco_id IS NOT NULL
--    AND created_at >= '2026-04-21'::timestamptz
--    AND status IN ('pendente', 'em_atendimento');

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
