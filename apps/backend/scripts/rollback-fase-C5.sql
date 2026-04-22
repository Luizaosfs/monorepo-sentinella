-- =============================================================================
-- ROLLBACK — Fase C.5 (Guards DELETE LGPD)
-- =============================================================================
-- Remove os 3 triggers BEFORE DELETE de clientes/imoveis/vistorias.
--
-- ⚠️ Não recomendado em produção. Os triggers são defesa LGPD.
-- Caso um cleanup de teste precise deletar registros, prefira:
--
--   BEGIN;
--   SET LOCAL session_replication_role = replica;  -- bypass transaction-local
--   DELETE FROM ...;
--   COMMIT;
--
-- Esse padrão não requer rollback e não expõe produção.
--
-- Se ainda assim quiser remover os triggers permanentemente:
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_bloquear_delete_cliente  ON public.clientes;
DROP TRIGGER IF EXISTS trg_bloquear_delete_imovel   ON public.imoveis;
DROP TRIGGER IF EXISTS trg_bloquear_delete_vistoria ON public.vistorias;

DROP FUNCTION IF EXISTS public.fn_bloquear_delete_cliente();
DROP FUNCTION IF EXISTS public.fn_bloquear_delete_imovel();
DROP FUNCTION IF EXISTS public.fn_bloquear_delete_vistoria();

-- Documenta em audit_log (se existir)
-- INSERT INTO audit_log (acao, tabela, descricao, created_at)
-- VALUES ('rollback_c5', 'system', 'Triggers DELETE LGPD removidas', now());

COMMIT;
