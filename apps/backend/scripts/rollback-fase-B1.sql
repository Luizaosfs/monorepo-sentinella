-- =============================================================================
-- ROLLBACK — FASE B.1: created_by / alterado_por / updated_by via CLS + Prisma
-- =============================================================================
-- Este script NÃO desfaz mudanças de código TypeScript — use `git revert` para
-- isso. O `createdByExtension` + `UserContextInterceptor` vivem em memória
-- do NestJS; sem eles, o comportamento volta ao estado pré-B.1 (autoria fica
-- NULL em todos os INSERTs/UPDATEs automáticos).
--
-- O que este SQL faz (opcional): documenta o rollback no audit_log. Não apaga
-- dados nem mexe nas colunas `created_by` / `alterado_por` / `updated_by` —
-- elas são `String? @db.Uuid` (nullable), então o estado pós-rollback é
-- consistente com o pré-B.1 (novos registros entram com NULL).
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-B1.sql
--
-- ⚠️ Ler cada bloco e comentar os que NÃO quiser rodar.
-- =============================================================================

BEGIN;

-- ── 1. Documentar o rollback no audit_log ────────────────────────────────────
INSERT INTO public.audit_log (acao, detalhes, created_at)
VALUES (
  'rollback_fase_B1_created_by',
  jsonb_build_object(
    'motivo',  'Rollback operacional da Fase B.1 (created_by/alterado_por/updated_by extension).',
    'aviso',   'Extension Prisma + UserContextInterceptor removidos via git revert + redeploy.',
    'colunas', jsonb_build_object(
      'created_by',   jsonb_build_array('focos_risco','casos_notificados','vistorias'),
      'alterado_por', jsonb_build_array('foco_risco_historico','levantamento_item_status_historico'),
      'updated_by',   jsonb_build_array('levantamento_itens')
    ),
    'data',    now()
  ),
  now()
);

-- ── 2. (Opcional) Reconstituir triggers SQL pré-migração ────────────────────
-- Caso queira voltar ao comportamento Supabase clássico (auth.uid() no DB via
-- trigger), descomentar os blocos abaixo. Como o banco novo NÃO tem `auth.uid()`
-- nativo (Supabase-only), seria necessário populá-lo por `SET LOCAL` — fora
-- do escopo deste rollback. Estes triggers servem apenas como referência.
--
-- CREATE OR REPLACE FUNCTION public.fn_set_created_by_from_jwt()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- BEGIN
--   IF NEW.created_by IS NULL THEN
--     NEW.created_by := nullif(current_setting('app.current_user_id', true), '')::uuid;
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- Aplicar em: focos_risco, casos_notificados, vistorias.
-- -- Exemplo:
-- -- DROP TRIGGER IF EXISTS trg_focos_risco_created_by ON public.focos_risco;
-- -- CREATE TRIGGER trg_focos_risco_created_by
-- --   BEFORE INSERT ON public.focos_risco
-- --   FOR EACH ROW
-- --   EXECUTE FUNCTION public.fn_set_created_by_from_jwt();
--
-- -- Análogos: fn_set_alterado_por_from_jwt (INSERT em foco_risco_historico,
-- -- levantamento_item_status_historico) e fn_set_updated_by_from_jwt (UPDATE
-- -- em levantamento_itens).

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
