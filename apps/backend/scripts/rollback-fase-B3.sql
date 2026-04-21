-- =============================================================================
-- ROLLBACK — FASE B.3: audit_log automático via Prisma Extension
-- =============================================================================
-- Este script NÃO desfaz mudanças de código TypeScript — use `git revert` para
-- isso. O `buildAuditLogExtension` vive em memória do NestJS; sem ele, o
-- comportamento volta ao estado pré-B.3 (nenhum INSERT automático em
-- `audit_log` — a tabela continua populável via INSERTs manuais de código
-- legado ou seeds).
--
-- Tabelas atingidas pela Fase B.3 (todas seguem inalteradas no banco):
--   - papeis_usuarios        (INSERT/UPDATE/DELETE)
--   - cliente_plano          (INSERT/UPDATE/DELETE)
--   - cliente_integracoes    (INSERT/UPDATE/DELETE; api_key filtrado)
--   - usuarios               (INSERT sempre; UPDATE só quando `ativo` muda;
--                             DELETE sempre; senha_hash filtrado)
--
-- O extension grava fire-and-forget + try/catch silencioso — o rollback
-- operacional (remover o `.$extends(buildAuditLogExtension(...))` em
-- `prisma.service.ts`) NÃO quebra nenhuma outra funcionalidade: apenas
-- cessa a produção de novos registros em `audit_log` via automação do app.
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-B3.sql
--
-- ⚠️ Ler cada bloco e comentar os que NÃO quiser rodar.
-- =============================================================================

BEGIN;

-- ── 1. Documentar o rollback no próprio audit_log ───────────────────────────
-- Usa as colunas reais do modelo (tabela/registro_id/dados_antes/dados_depois/
-- operacao/created_at). Registro sentinela para análise forense posterior.
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
  '__rollback_fase_B3__',
  NULL,
  NULL,
  jsonb_build_object(
    'motivo', 'Rollback operacional da Fase B.3 (audit-log extension).',
    'aviso',  'Extension Prisma removido via git revert + redeploy.',
    'escopo', jsonb_build_object(
      'papeis_usuarios',     jsonb_build_array('INSERT','UPDATE','DELETE'),
      'cliente_plano',       jsonb_build_array('INSERT','UPDATE','DELETE'),
      'cliente_integracoes', jsonb_build_array('INSERT','UPDATE','DELETE'),
      'usuarios',            jsonb_build_array('INSERT','UPDATE(apenas ativo)','DELETE')
    ),
    'campos_filtrados', jsonb_build_array('senha_hash','api_key'),
    'data',             now()
  ),
  'ROLLBACK',
  now()
);

-- ── 2. (Opcional) Reconstituir triggers SQL pré-migração Supabase ───────────
-- Caso queira voltar ao comportamento de trigger SQL clássico (registros em
-- `audit_log` feitos pelo banco, não pelo app), descomentar e adaptar. O banco
-- novo NÃO tem `auth.uid()` nativo — seria necessário popular via
-- `SET LOCAL app.current_user_id = '...'` por transação. Fora do escopo deste
-- rollback; mantido aqui apenas como referência histórica.
--
-- CREATE OR REPLACE FUNCTION public.fn_audit_trail()
-- RETURNS trigger LANGUAGE plpgsql AS $fn$
-- DECLARE
--   v_before  jsonb;
--   v_after   jsonb;
--   v_user_id uuid := nullif(current_setting('app.current_user_id', true), '')::uuid;
-- BEGIN
--   IF TG_OP = 'INSERT' THEN
--     v_after := to_jsonb(NEW);
--   ELSIF TG_OP = 'UPDATE' THEN
--     v_before := to_jsonb(OLD);
--     v_after  := to_jsonb(NEW);
--   ELSIF TG_OP = 'DELETE' THEN
--     v_before := to_jsonb(OLD);
--   END IF;
--
--   INSERT INTO public.audit_log (
--     cliente_id, usuario_id, tabela, registro_id,
--     dados_antes, dados_depois, operacao, created_at
--   ) VALUES (
--     COALESCE((v_after->>'cliente_id')::uuid, (v_before->>'cliente_id')::uuid),
--     v_user_id,
--     TG_TABLE_NAME,
--     COALESCE((v_after->>'id')::uuid, (v_before->>'id')::uuid),
--     v_before,
--     v_after,
--     TG_OP,
--     now()
--   );
--
--   RETURN COALESCE(NEW, OLD);
-- END;
-- $fn$;
--
-- -- Aplicar por tabela (exemplo cliente_plano):
-- -- DROP TRIGGER IF EXISTS trg_cliente_plano_audit ON public.cliente_plano;
-- -- CREATE TRIGGER trg_cliente_plano_audit
-- --   AFTER INSERT OR UPDATE OR DELETE ON public.cliente_plano
-- --   FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trail();
-- --
-- -- Análogo para papeis_usuarios, cliente_integracoes (com filtro de api_key
-- -- dentro da própria fn_audit_trail) e usuarios (com filtro de senha_hash
-- -- e gate no OLD.ativo <> NEW.ativo para UPDATE).

-- ── 3. (Opcional) Purgar registros gerados pela B.3 ────────────────────────
-- Os registros automáticos têm `operacao IN ('INSERT','UPDATE','DELETE')` e
-- foram criados pelo extension entre a data do deploy da B.3 e o rollback.
-- NÃO executar sem revisão — LGPD pode exigir preservação da trilha.
--
-- DELETE FROM public.audit_log
--  WHERE tabela IN ('papeis_usuarios','cliente_plano','cliente_integracoes','usuarios')
--    AND operacao IN ('INSERT','UPDATE','DELETE')
--    AND created_at >= '2026-04-21'::timestamptz;  -- ajustar para data real do deploy

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
