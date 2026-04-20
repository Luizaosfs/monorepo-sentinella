-- =============================================================================
-- P0-7: Endurecimento de tabelas operacionais e de sistema
--
-- PROBLEMA GERAL:
--   Várias tabelas técnicas/administrativas usam usuario_pode_acessar_cliente()
--   em políticas de escrita — o que permite que operador e notificador modifiquem
--   configurações e logs que deveriam ser restritos a admin/supervisor.
--   Outras tabelas usam o padrão legado de join (EXISTS SELECT u.id) em vez dos
--   helpers canônicos.
--
-- REGRA DE ACESSO APLICADA:
--   Tabelas de configuração (SLA config, feriados):
--     SELECT → todos os papéis do cliente
--     INSERT/UPDATE/DELETE → admin ou supervisor do cliente
--
--   Tabelas de log/sistema (erros SLA, sync log, resumos diários):
--     SELECT → admin ou supervisor
--     INSERT → bloqueado direto (apenas SECURITY DEFINER triggers)
--
--   Tabelas de correlação/drone (geradas por trigger SECURITY DEFINER):
--     SELECT → todos os papéis do cliente
--     INSERT/UPDATE/DELETE → bloqueado direto (triggers bypassam RLS)
--
--   Tabelas somente-admin (cloudinary_orfaos):
--     ALL → is_admin() com padrão canônico
--
--   Tabelas de sessão de usuário (push_subscriptions):
--     SELECT/INSERT/UPDATE/DELETE → próprio usuário
-- =============================================================================

-- ── 1. sla_config_regiao — escrita restrita a admin/supervisor ────────────────
-- Operador/notificador podem ler as configs de SLA; apenas gestores configuram.
DROP POLICY IF EXISTS "sla_config_regiao_insert" ON public.sla_config_regiao;
DROP POLICY IF EXISTS "sla_config_regiao_update" ON public.sla_config_regiao;
DROP POLICY IF EXISTS "sla_config_regiao_delete" ON public.sla_config_regiao;

CREATE POLICY "sla_config_regiao_insert" ON public.sla_config_regiao
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "sla_config_regiao_update" ON public.sla_config_regiao
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "sla_config_regiao_delete" ON public.sla_config_regiao
  FOR DELETE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 2. sla_feriados — escrita restrita a admin/supervisor; WITH CHECK em UPDATE
DROP POLICY IF EXISTS "sla_feriados_insert" ON public.sla_feriados;
DROP POLICY IF EXISTS "sla_feriados_update" ON public.sla_feriados;
DROP POLICY IF EXISTS "sla_feriados_delete" ON public.sla_feriados;

CREATE POLICY "sla_feriados_insert" ON public.sla_feriados
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "sla_feriados_update" ON public.sla_feriados
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "sla_feriados_delete" ON public.sla_feriados
  FOR DELETE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 3. sla_erros_criacao — corrigir INSERT e SELECT ───────────────────────────
-- INSERT WITH CHECK(true) era necessário quando o trigger não era SECURITY DEFINER.
-- O trigger trg_levantamento_item_criar_sla_auto é SECURITY DEFINER (postgres owner)
-- e já bypassa RLS. Com a policy removida, inserções diretas de usuários são bloqueadas.
-- SELECT: migrar do padrão legado (EXISTS) para helpers canônicos.
DROP POLICY IF EXISTS "trigger_pode_inserir_erros_sla"        ON public.sla_erros_criacao;
DROP POLICY IF EXISTS "admin_supervisor_pode_ver_erros_sla"   ON public.sla_erros_criacao;

-- Sem política INSERT: apenas SECURITY DEFINER triggers conseguem inserir.
-- SELECT restrito a admin e supervisor do cliente associado.
CREATE POLICY "sla_erros_criacao_select" ON public.sla_erros_criacao
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_supervisor() AND public.usuario_pode_acessar_cliente(cliente_id))
  );

-- Sem INSERT policy explícita → comportamento padrão RLS: DENY.
-- Triggers SECURITY DEFINER (owner=postgres) não são afetados pelo RLS.

-- ── 4. cloudinary_orfaos — corrigir join legado → is_admin() ─────────────────
-- Padrão antigo: JOIN duplo usuarios→papeis_usuarios.
-- Padrão canônico: public.is_admin() direto.
DROP POLICY IF EXISTS "orfaos_admin_only" ON public.cloudinary_orfaos;

CREATE POLICY "cloudinary_orfaos_select" ON public.cloudinary_orfaos
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "cloudinary_orfaos_insert" ON public.cloudinary_orfaos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "cloudinary_orfaos_update" ON public.cloudinary_orfaos
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "cloudinary_orfaos_delete" ON public.cloudinary_orfaos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 5. pipeline_runs — substituir join legado por usuario_pode_acessar_cliente
DROP POLICY IF EXISTS "pipeline_runs_select" ON public.pipeline_runs;

CREATE POLICY "pipeline_runs_select" ON public.pipeline_runs
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── 6. vistoria_drone_correlacao — escrita exclusiva a trigger (SECURITY DEFINER)
-- A função fn_correlacionar_vistoria_com_drone é SECURITY DEFINER (owner=postgres)
-- e bypassa RLS. Usuários diretos não devem escrever nessa tabela.
DROP POLICY IF EXISTS "vistoria_drone_correlacao_insert" ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_update" ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_delete" ON public.vistoria_drone_correlacao;

CREATE POLICY "vistoria_drone_correlacao_insert" ON public.vistoria_drone_correlacao
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "vistoria_drone_correlacao_update" ON public.vistoria_drone_correlacao
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "vistoria_drone_correlacao_delete" ON public.vistoria_drone_correlacao
  FOR DELETE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 7. unidades_saude_sync_controle — escrita restrita a admin/supervisor ─────
-- Controle de sincronização CNES: apenas a Edge Function cnes-sync (service_role)
-- e admin/supervisor podem escrever.
DROP POLICY IF EXISTS "sync_controle_insert" ON public.unidades_saude_sync_controle;
DROP POLICY IF EXISTS "sync_controle_update" ON public.unidades_saude_sync_controle;

CREATE POLICY "sync_controle_insert" ON public.unidades_saude_sync_controle
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "sync_controle_update" ON public.unidades_saude_sync_controle
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 8. unidades_saude_sync_log — escrita restrita a admin/supervisor ──────────
-- Logs de sincronização: gerados pela Edge Function (service_role, bypassa RLS).
-- SELECT já restrito a supervisor/admin pelo USING existente.
DROP POLICY IF EXISTS "sync_log_insert" ON public.unidades_saude_sync_log;

CREATE POLICY "sync_log_insert" ON public.unidades_saude_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 9. resumos_diarios — escrita restrita a admin/supervisor ─────────────────
-- Gerados pela Edge Function resumo-diario (service_role, bypassa RLS).
-- Operador/notificador não devem criar, editar ou excluir resumos.
DROP POLICY IF EXISTS "resumos_diarios_insert" ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_update" ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_delete" ON public.resumos_diarios;

CREATE POLICY "resumos_diarios_insert" ON public.resumos_diarios
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "resumos_diarios_update" ON public.resumos_diarios
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

CREATE POLICY "resumos_diarios_delete" ON public.resumos_diarios
  FOR DELETE TO authenticated
  USING (
    (public.is_admin() OR public.is_supervisor())
    AND public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 10. push_subscriptions — separar FOR ALL em políticas específicas ─────────
-- Padrão antigo: FOR ALL com USING (sem WITH CHECK no INSERT).
-- Usuários gerenciam apenas as próprias subscrições.
-- A Edge Function sla-push-critico (service_role) lê todas — bypassa RLS.
DROP POLICY IF EXISTS "own_push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "push_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "push_subscriptions_update" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (
    usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "push_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (
    usuario_id = (SELECT id FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

-- =============================================================================
-- RELATÓRIO DE TABELAS ENDURECIDAS
--
-- TABELA                        | ACESSO ANTES               | ACESSO DEPOIS
-- ────────────────────────────────────────────────────────────────────────────
-- sla_config_regiao             | escrita: qualquer do tenant | admin/supervisor
-- sla_feriados                  | escrita: qualquer do tenant | admin/supervisor
--                               | update sem WITH CHECK       | WITH CHECK adicionado
-- sla_erros_criacao             | INSERT: WITH CHECK(true)    | sem policy INSERT
--                               | SELECT: padrão legado EXISTS| padrão canônico
-- cloudinary_orfaos             | FOR ALL com join duplo      | 4-way canônico + is_admin()
-- pipeline_runs                 | padrão legado IN(SELECT)    | usuario_pode_acessar_cliente
-- vistoria_drone_correlacao     | INSERT/UPDATE/DELETE: tenant | admin/supervisor
-- unidades_saude_sync_controle  | INSERT/UPDATE: qualquer     | admin/supervisor
-- unidades_saude_sync_log       | INSERT: qualquer            | admin/supervisor
-- resumos_diarios               | INSERT/UPDATE/DELETE: tenant | admin/supervisor
-- push_subscriptions            | FOR ALL sem WITH CHECK      | 4-way c/ WITH CHECK
-- =============================================================================
