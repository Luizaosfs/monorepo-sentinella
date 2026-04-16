-- =============================================================================
-- CLEANUP-03: Remover políticas RLS duplicadas / old-style
--
-- Contexto:
--   - M08 (20260912040000) criou políticas novas mas NÃO dropou as antigas old-style
--   - Políticas PERMISSIVE duplicadas fazem OR — sem vazamento mas confuso e mais lento
--   - caso_foco_cruzamento: JÁ tratado em FIX-08b (20260913000003) — NÃO mexer aqui
--
-- Tabelas tratadas:
--   yolo_feedback             — dropar "yolo_feedback_isolamento" (M08 já criou select/insert/update/delete)
--   levantamento_analise_ia   — dropar "analise_ia_isolamento" (M08 já criou as 4 políticas)
--   vistoria_drone_correlacao — dropar "corr_isolamento" e criar políticas padronizadas
--   resumos_diarios           — dropar "resumos_isolamento" e criar políticas padronizadas
--   cliente_integracoes       — dropar "isolamento_cliente_integracoes" e criar políticas padronizadas
--   item_notificacoes_esus    — dropar "isolamento_item_notificacoes_esus" e criar políticas padronizadas
--   unidades_saude_sync_*     — dropar old-style e criar políticas padronizadas
-- =============================================================================

-- =============================================================================
-- yolo_feedback — M08 criou as 4 políticas, dropar duplicata old-style
-- =============================================================================
DROP POLICY IF EXISTS "yolo_feedback_isolamento" ON public.yolo_feedback;

-- =============================================================================
-- levantamento_analise_ia — M08 criou as 4 políticas, dropar duplicata old-style
-- =============================================================================
DROP POLICY IF EXISTS "analise_ia_isolamento" ON public.levantamento_analise_ia;

-- =============================================================================
-- vistoria_drone_correlacao
-- =============================================================================
ALTER TABLE public.vistoria_drone_correlacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corr_isolamento"                    ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_select"   ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_insert"   ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_update"   ON public.vistoria_drone_correlacao;
DROP POLICY IF EXISTS "vistoria_drone_correlacao_delete"   ON public.vistoria_drone_correlacao;

CREATE POLICY "vistoria_drone_correlacao_select" ON public.vistoria_drone_correlacao
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_drone_correlacao_insert" ON public.vistoria_drone_correlacao
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_drone_correlacao_update" ON public.vistoria_drone_correlacao
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "vistoria_drone_correlacao_delete" ON public.vistoria_drone_correlacao
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- resumos_diarios
-- =============================================================================
ALTER TABLE public.resumos_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumos_isolamento"      ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_select"  ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_insert"  ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_update"  ON public.resumos_diarios;
DROP POLICY IF EXISTS "resumos_diarios_delete"  ON public.resumos_diarios;

CREATE POLICY "resumos_diarios_select" ON public.resumos_diarios
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "resumos_diarios_insert" ON public.resumos_diarios
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "resumos_diarios_update" ON public.resumos_diarios
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "resumos_diarios_delete" ON public.resumos_diarios
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- cliente_integracoes
-- =============================================================================
ALTER TABLE public.cliente_integracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolamento_cliente_integracoes"   ON public.cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_select"       ON public.cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_insert"       ON public.cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_update"       ON public.cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_delete"       ON public.cliente_integracoes;

CREATE POLICY "cliente_integracoes_select" ON public.cliente_integracoes
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "cliente_integracoes_insert" ON public.cliente_integracoes
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "cliente_integracoes_update" ON public.cliente_integracoes
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "cliente_integracoes_delete" ON public.cliente_integracoes
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- item_notificacoes_esus
-- =============================================================================
ALTER TABLE public.item_notificacoes_esus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolamento_item_notificacoes_esus" ON public.item_notificacoes_esus;
DROP POLICY IF EXISTS "item_notificacoes_esus_select"     ON public.item_notificacoes_esus;
DROP POLICY IF EXISTS "item_notificacoes_esus_insert"     ON public.item_notificacoes_esus;
DROP POLICY IF EXISTS "item_notificacoes_esus_update"     ON public.item_notificacoes_esus;
DROP POLICY IF EXISTS "item_notificacoes_esus_delete"     ON public.item_notificacoes_esus;

CREATE POLICY "item_notificacoes_esus_select" ON public.item_notificacoes_esus
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "item_notificacoes_esus_insert" ON public.item_notificacoes_esus
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "item_notificacoes_esus_update" ON public.item_notificacoes_esus
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "item_notificacoes_esus_delete" ON public.item_notificacoes_esus
  FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- unidades_saude_sync_controle
-- =============================================================================
ALTER TABLE public.unidades_saude_sync_controle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_controle_isolamento"   ON public.unidades_saude_sync_controle;
DROP POLICY IF EXISTS "sync_controle_select"       ON public.unidades_saude_sync_controle;
DROP POLICY IF EXISTS "sync_controle_insert"       ON public.unidades_saude_sync_controle;
DROP POLICY IF EXISTS "sync_controle_update"       ON public.unidades_saude_sync_controle;
DROP POLICY IF EXISTS "sync_controle_delete"       ON public.unidades_saude_sync_controle;

CREATE POLICY "sync_controle_select" ON public.unidades_saude_sync_controle
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "sync_controle_insert" ON public.unidades_saude_sync_controle
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "sync_controle_update" ON public.unidades_saude_sync_controle
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- unidades_saude_sync_log
-- =============================================================================
ALTER TABLE public.unidades_saude_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_log_isolamento"  ON public.unidades_saude_sync_log;
DROP POLICY IF EXISTS "sync_log_select"      ON public.unidades_saude_sync_log;
DROP POLICY IF EXISTS "sync_log_insert"      ON public.unidades_saude_sync_log;

CREATE POLICY "sync_log_select" ON public.unidades_saude_sync_log
  FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id));
CREATE POLICY "sync_log_insert" ON public.unidades_saude_sync_log
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
