-- =============================================================================
-- ROLLBACK — FASE B.2: updated_at automático via Prisma Client Extension
-- =============================================================================
-- Este script NÃO desfaz mudanças de código TypeScript — use `git revert` para
-- isso. O extension vive em memória do NestJS; sem extension, o comportamento
-- volta ao estado pré-B.2 (updated_at congelado em UPDATEs).
--
-- O que este SQL faz: corrige registros cujo updated_at ficou DEFASADO durante
-- o período em que a Fase B.2 esteve ativa + problemas ocorreram — setando
-- updated_at = now() nos casos onde claramente houve uma mutação recente mas
-- o timestamp não acompanhou. Só faz sentido executar se uma regressão do
-- extension causou dados inconsistentes.
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-B2.sql
--
-- ⚠️ Ler cada bloco e comentar os que NÃO quiser rodar.
-- =============================================================================

BEGIN;

-- ── 1. Documentar o rollback no audit_log ────────────────────────────────────
INSERT INTO public.audit_log (acao, detalhes, created_at)
VALUES (
  'rollback_fase_B2_updated_at',
  jsonb_build_object(
    'motivo', 'Rollback operacional da Fase B.2 (updated_at extension).',
    'aviso',  'Extension Prisma removida via git revert + redeploy. SQL não apaga dados.',
    'data',   now()
  ),
  now()
);

-- ── 2. (Opcional) Reconstituir trigger SQL clássico caso queira voltar 100% ──
-- ao comportamento pré-migração (trigger no DB). Descomentar e ajustar lista
-- de tabelas conforme necessário. Esta é a MESMA função que existia no
-- Supabase legado (fonte: dump original).
--
-- CREATE OR REPLACE FUNCTION public.fn_set_updated_at_generic()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $fn$
-- BEGIN
--   NEW.updated_at := now();
--   RETURN NEW;
-- END;
-- $fn$;
--
-- -- Aplicar em cada tabela que tem updated_at (lista = 36 tabelas da B.2):
-- -- CREATE TRIGGER trg_<tabela>_updated_at
-- --   BEFORE UPDATE ON public.<tabela>
-- --   FOR EACH ROW
-- --   EXECUTE FUNCTION public.fn_set_updated_at_generic();
--
-- -- Exemplo (focos_risco):
-- -- DROP TRIGGER IF EXISTS trg_focos_risco_updated_at ON public.focos_risco;
-- -- CREATE TRIGGER trg_focos_risco_updated_at
-- --   BEFORE UPDATE ON public.focos_risco
-- --   FOR EACH ROW
-- --   EXECUTE FUNCTION public.fn_set_updated_at_generic();

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
