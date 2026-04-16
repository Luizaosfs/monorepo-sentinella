-- =============================================================================
-- FIX: Migrar políticas RLS legadas para usuario_pode_acessar_cliente()
--
-- Padrão PROIBIDO:
--   USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()))
--
-- Motivo: menos eficiente (subquery por row) e não trata admin corretamente
--   (admin pertence a um cliente mas deve ver todos — usuario_pode_acessar_cliente
--    já lida com isso internamente).
--
-- Tabelas corrigidas:
--   yolo_feedback, levantamento_analise_ia           (20250317002000)
--   unidades_saude, casos_notificados,               (20250318000000)
--   caso_foco_cruzamento
--   imoveis, vistorias, vistoria_sintomas,           (20250318001000)
--   vistoria_riscos
--   score_config, territorio_score                   (20260751000000 / 20260757)
-- =============================================================================

-- ── yolo_feedback ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "yolo_feedback_isolamento" ON public.yolo_feedback;
CREATE POLICY "yolo_feedback_isolamento" ON public.yolo_feedback
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── levantamento_analise_ia ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "analise_ia_isolamento" ON public.levantamento_analise_ia;
CREATE POLICY "analise_ia_isolamento" ON public.levantamento_analise_ia
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── unidades_saude ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "unidades_saude_isolamento" ON public.unidades_saude;
CREATE POLICY "unidades_saude_isolamento" ON public.unidades_saude
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── casos_notificados ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "casos_notificados_isolamento" ON public.casos_notificados;
CREATE POLICY "casos_notificados_isolamento" ON public.casos_notificados
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── caso_foco_cruzamento ──────────────────────────────────────────────────────
-- Leitura isolada por cliente via JOIN; INSERT apenas pelo trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS "caso_foco_cruzamento_isolamento" ON public.caso_foco_cruzamento;
DROP POLICY IF EXISTS "caso_foco_cruzamento_select"    ON public.caso_foco_cruzamento;
CREATE POLICY "caso_foco_cruzamento_select" ON public.caso_foco_cruzamento
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.casos_notificados cn
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND public.usuario_pode_acessar_cliente(cn.cliente_id)
    )
  );

-- ── imoveis ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "imoveis_isolamento" ON public.imoveis;
CREATE POLICY "imoveis_isolamento" ON public.imoveis
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistorias ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistorias_isolamento" ON public.vistorias;
CREATE POLICY "vistorias_isolamento" ON public.vistorias
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_sintomas ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistoria_sintomas_isolamento" ON public.vistoria_sintomas;
CREATE POLICY "vistoria_sintomas_isolamento" ON public.vistoria_sintomas
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_riscos ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistoria_riscos_isolamento" ON public.vistoria_riscos;
CREATE POLICY "vistoria_riscos_isolamento" ON public.vistoria_riscos
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_riscos.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_riscos.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- ── score_config ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "score_config_select"  ON public.score_config;
DROP POLICY IF EXISTS "score_config_upsert"  ON public.score_config;
DROP POLICY IF EXISTS "score_config_mutate"  ON public.score_config;

CREATE POLICY "score_config_select" ON public.score_config
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- admin (SaaS owner) ou supervisor da prefeitura podem configurar score
CREATE POLICY "score_config_mutate" ON public.score_config
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id) AND (public.is_admin() OR public.is_supervisor()))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id) AND (public.is_admin() OR public.is_supervisor()));

-- ── territorio_score ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "territorio_score_select" ON public.territorio_score;
DROP POLICY IF EXISTS "territorio_score_upsert" ON public.territorio_score;

CREATE POLICY "territorio_score_select" ON public.territorio_score
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- Upsert feito apenas pelo Edge Function score-worker via service role (bypassa RLS).
-- Política explícita de bloqueio para usuários comuns:
CREATE POLICY "territorio_score_deny_mutate" ON public.territorio_score
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
