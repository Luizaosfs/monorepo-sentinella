-- =============================================================================
-- P0-2: Limpeza de policies duplicadas e correção de policies incompletas
--
-- CAUSA RAIZ:
--   A migration 20261013000001_fix_rls_legacy_pattern recriou políticas
--   _isolamento (FOR ALL) em 4 tabelas que a 20260912040000_m08_rls_padronizar
--   já havia migrado para o conjunto canônico de 4 políticas específicas
--   (select/insert/update/delete). Com dois conjuntos ativos, o PostgreSQL
--   aplica OR — sem buracos de segurança, mas dificulta auditoria futura.
--
-- TABELAS AFETADAS (redundância _isolamento vs split 4-way):
--   imoveis, vistorias, vistoria_sintomas, vistoria_riscos
--
-- CORREÇÃO ADICIONAL:
--   focos_risco_update sem WITH CHECK — troca de cliente_id em UPDATE
--   não era verificada pelo banco.
-- =============================================================================

-- ── 1. imoveis — drop _isolamento redundante ──────────────────────────────────
-- Conjunto canônico: imoveis_select / imoveis_insert / imoveis_update / imoveis_delete
-- (criado em 20260912040000_m08_rls_padranizar)
DROP POLICY IF EXISTS "imoveis_isolamento" ON public.imoveis;

-- ── 2. vistorias — drop _isolamento redundante ────────────────────────────────
-- Conjunto canônico: vistorias_select / vistorias_insert / vistorias_update / vistorias_delete
-- (criado em 20260912040000)
DROP POLICY IF EXISTS "vistorias_isolamento" ON public.vistorias;

-- ── 3. vistoria_sintomas — drop _isolamento redundante ───────────────────────
-- Conjunto canônico: vistoria_sintomas_select/insert/update/delete
-- (criado em 20260912040000)
DROP POLICY IF EXISTS "vistoria_sintomas_isolamento" ON public.vistoria_sintomas;

-- ── 4. vistoria_riscos — drop _isolamento redundante ─────────────────────────
-- Conjunto canônico: vistoria_riscos_select/insert/update/delete
-- (criado em 20260912040000)
DROP POLICY IF EXISTS "vistoria_riscos_isolamento" ON public.vistoria_riscos;

-- ── 5. focos_risco_update — adicionar WITH CHECK ──────────────────────────────
-- Política original (20260710) só tinha USING, sem WITH CHECK.
-- Sem WITH CHECK, um UPDATE poderia mover um foco para outro cliente_id
-- mesmo que o RLS bloqueie a leitura da linha destino.
DROP POLICY IF EXISTS "focos_risco_update" ON public.focos_risco;
CREATE POLICY "focos_risco_update" ON public.focos_risco
  FOR UPDATE TO authenticated
  USING     (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- ESTADO FINAL ESPERADO POR TABELA (apenas políticas ativas após esta migration)
--
-- imoveis:
--   imoveis_select       SELECT  usuario_pode_acessar_cliente(cliente_id)
--   imoveis_insert       INSERT  usuario_pode_acessar_cliente(cliente_id)
--   imoveis_update       UPDATE  usuario_pode_acessar_cliente(cliente_id)
--   imoveis_delete       DELETE  usuario_pode_acessar_cliente(cliente_id)
--
-- vistorias:
--   vistorias_select     SELECT  usuario_pode_acessar_cliente(cliente_id)
--   vistorias_insert     INSERT  usuario_pode_acessar_cliente(cliente_id)
--   vistorias_update     UPDATE  usuario_pode_acessar_cliente(cliente_id)
--   vistorias_delete     DELETE  usuario_pode_acessar_cliente(cliente_id)
--
-- vistoria_sintomas:
--   vistoria_sintomas_select/insert/update/delete (idem)
--
-- vistoria_riscos:
--   vistoria_riscos_select/insert/update/delete (idem, riscos via JOIN vistorias)
--
-- focos_risco:
--   focos_risco_select   SELECT  usuario_pode_acessar_cliente(cliente_id)
--   focos_risco_insert   INSERT  usuario_pode_acessar_cliente(cliente_id)
--   focos_risco_update   UPDATE  USING + WITH CHECK usuario_pode_acessar_cliente ← corrigido
--   (sem DELETE: bloqueado por trg_bloquear_hard_delete — soft delete via deleted_at)
--
-- POLICIES INTENCIONALMENTE AMPLAS (não alteradas):
--   planos.planos_select          USING(true) — catálogo público de planos SaaS
--   sla_erros_criacao.*           WITH CHECK(true) no INSERT — triggers inserem livremente
-- =============================================================================
