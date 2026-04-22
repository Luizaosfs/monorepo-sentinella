-- =============================================================================
-- ROLLBACK — FASE C.2: Reinspeção no fluxo de foco (Sentinella Backend)
-- =============================================================================
-- Esta fase portou 2 triggers do Supabase legado para use-cases TypeScript:
--   - fn_criar_reinspecao_pos_tratamento     → CriarReinspecaoPosTratamento
--   - fn_cancelar_reinspecoes_ao_fechar_foco → CancelarReinspecoesAoFecharFoco
--
-- Ambos são invocados dentro do `$transaction(callback)` do TransicionarFocoRisco
-- (transação interativa introduzida na Fase C.1). Para reverter a Fase C.2
-- operacionalmente: `git revert` dos commits + redeploy. O Transicionar volta
-- ao fluxo pré-C.2 (sem criar/cancelar reinspeções automaticamente).
-- O banco fica inalterado — este script apenas DOCUMENTA o rollback em
-- `audit_log` e oferece, OPCIONALMENTE, a reconstituição dos triggers SQL
-- antigos (mantidos aqui como referência histórica).
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-C2.sql
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
  '__rollback_fase_C2__',
  NULL,
  NULL,
  jsonb_build_object(
    'motivo', 'Rollback operacional da Fase C.2 (Reinspeção no fluxo de foco).',
    'aviso',  'Use-cases removidos via git revert + redeploy.',
    'escopo', jsonb_build_object(
      'criar_reinspecao_pos_tratamento',     'porte de fn_criar_reinspecao_pos_tratamento',
      'cancelar_reinspecoes_ao_fechar_foco', 'porte de fn_cancelar_reinspecoes_ao_fechar_foco'
    ),
    'compensacao', 'sla_erros_criacao grava erros fora da transação quando hook (SLA ou reinspeção) falha',
    'data',        now()
  ),
  'ROLLBACK',
  now()
);

-- ── 2. (Opcional) Reconstituir triggers SQL pré-migração Supabase ──────────
-- Se quiser voltar ao comportamento de trigger SQL clássico, descomentar os
-- blocos abaixo. Replicam os triggers originais do Supabase de forma
-- aproximada — `auth.uid()` não existe no banco self-hosted, então os
-- `cancelado_por` ficam NULL (perda aceita em caso de rollback).
--
-- -- fn_criar_reinspecao_pos_tratamento
-- CREATE OR REPLACE FUNCTION public.fn_criar_reinspecao_pos_tratamento()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- BEGIN
--   IF NEW.status = 'em_tratamento'
--      AND (OLD.status IS DISTINCT FROM 'em_tratamento') THEN
--     -- Idempotência: só cria se NÃO há reinspeção pendente do mesmo tipo.
--     IF NOT EXISTS (
--       SELECT 1 FROM reinspecoes_programadas
--        WHERE foco_risco_id = NEW.id
--          AND tipo = 'eficacia_pos_tratamento'
--          AND status = 'pendente'
--     ) THEN
--       INSERT INTO reinspecoes_programadas (
--         cliente_id, foco_risco_id, status, tipo, origem,
--         data_prevista, created_at, updated_at
--       )
--       VALUES (
--         NEW.cliente_id, NEW.id, 'pendente',
--         'eficacia_pos_tratamento', 'tratamento_confirmado',
--         now() + interval '7 days', now(), now()
--       );
--     END IF;
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- fn_cancelar_reinspecoes_ao_fechar_foco
-- CREATE OR REPLACE FUNCTION public.fn_cancelar_reinspecoes_ao_fechar_foco()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- BEGIN
--   IF NEW.status IN ('resolvido', 'descartado')
--      AND OLD.status NOT IN ('resolvido', 'descartado') THEN
--     UPDATE reinspecoes_programadas
--        SET status = 'cancelada',
--            motivo_cancelamento = 'Foco fechado automaticamente',
--            updated_at = now()
--      WHERE foco_risco_id = NEW.id
--        AND status = 'pendente';
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- Triggers propriamente ditos
-- DROP TRIGGER IF EXISTS trg_criar_reinspecao_pos_tratamento ON public.focos_risco;
-- CREATE TRIGGER trg_criar_reinspecao_pos_tratamento
--   AFTER UPDATE OF status ON public.focos_risco
--   FOR EACH ROW EXECUTE FUNCTION public.fn_criar_reinspecao_pos_tratamento();
--
-- DROP TRIGGER IF EXISTS trg_cancelar_reinspecoes_ao_fechar_foco ON public.focos_risco;
-- CREATE TRIGGER trg_cancelar_reinspecoes_ao_fechar_foco
--   AFTER UPDATE OF status ON public.focos_risco
--   FOR EACH ROW EXECUTE FUNCTION public.fn_cancelar_reinspecoes_ao_fechar_foco();

-- ── 3. (Opcional) Purgar reinspeções criadas automaticamente pela Fase C.2 ─
-- A identificação exata depende do deploy — ajustar `created_at >= ...` para
-- a data/hora real de go-live da Fase C.2. NÃO rodar sem revisão.
--
-- DELETE FROM public.reinspecoes_programadas
--  WHERE origem = 'tratamento_confirmado'
--    AND created_at >= '2026-04-21'::timestamptz
--    AND status = 'pendente';

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
