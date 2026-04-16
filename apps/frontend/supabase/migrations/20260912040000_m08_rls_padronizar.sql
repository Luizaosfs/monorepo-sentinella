-- =============================================================================
-- M08: Padronizar políticas RLS para usar usuario_pode_acessar_cliente()
--
-- Tabelas migradas para o padrão canônico de isolamento por cliente:
--   unidades_saude, casos_notificados, imoveis, vistorias,
--   vistoria_depositos, vistoria_sintomas, vistoria_riscos, vistoria_calhas,
--   yolo_feedback, levantamento_analise_ia
-- =============================================================================

-- ── Helper: garante que RLS está habilitado ───────────────────────────────────
ALTER TABLE public.unidades_saude         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos_notificados      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistoria_depositos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistoria_sintomas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistoria_riscos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistoria_calhas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yolo_feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levantamento_analise_ia ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- unidades_saude
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.unidades_saude;
DROP POLICY IF EXISTS "unidades_saude_select"          ON public.unidades_saude;
DROP POLICY IF EXISTS "unidades_saude_insert"          ON public.unidades_saude;
DROP POLICY IF EXISTS "unidades_saude_update"          ON public.unidades_saude;
DROP POLICY IF EXISTS "unidades_saude_delete"          ON public.unidades_saude;

CREATE POLICY "unidades_saude_select" ON public.unidades_saude
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "unidades_saude_insert" ON public.unidades_saude
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "unidades_saude_update" ON public.unidades_saude
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "unidades_saude_delete" ON public.unidades_saude
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- casos_notificados
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.casos_notificados;
DROP POLICY IF EXISTS "casos_notificados_select"       ON public.casos_notificados;
DROP POLICY IF EXISTS "casos_notificados_insert"       ON public.casos_notificados;
DROP POLICY IF EXISTS "casos_notificados_update"       ON public.casos_notificados;
DROP POLICY IF EXISTS "casos_notificados_delete"       ON public.casos_notificados;

CREATE POLICY "casos_notificados_select" ON public.casos_notificados
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "casos_notificados_insert" ON public.casos_notificados
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "casos_notificados_update" ON public.casos_notificados
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "casos_notificados_delete" ON public.casos_notificados
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- imoveis
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_select"                 ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert"                 ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update"                 ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete"                 ON public.imoveis;

CREATE POLICY "imoveis_select" ON public.imoveis
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "imoveis_insert" ON public.imoveis
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "imoveis_update" ON public.imoveis
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "imoveis_delete" ON public.imoveis
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- vistorias
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_select"               ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_insert"               ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_update"               ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_delete"               ON public.vistorias;

CREATE POLICY "vistorias_select" ON public.vistorias
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistorias_insert" ON public.vistorias
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistorias_update" ON public.vistorias
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistorias_delete" ON public.vistorias
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- vistoria_depositos (sub-tabela: join via vistoria_id)
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_select"      ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_insert"      ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_update"      ON public.vistoria_depositos;
DROP POLICY IF EXISTS "vistoria_depositos_delete"      ON public.vistoria_depositos;

CREATE POLICY "vistoria_depositos_select" ON public.vistoria_depositos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_depositos_insert" ON public.vistoria_depositos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_depositos_update" ON public.vistoria_depositos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_depositos_delete" ON public.vistoria_depositos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- =============================================================================
-- vistoria_sintomas
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.vistoria_sintomas;
DROP POLICY IF EXISTS "vistoria_sintomas_select"       ON public.vistoria_sintomas;
DROP POLICY IF EXISTS "vistoria_sintomas_insert"       ON public.vistoria_sintomas;
DROP POLICY IF EXISTS "vistoria_sintomas_update"       ON public.vistoria_sintomas;
DROP POLICY IF EXISTS "vistoria_sintomas_delete"       ON public.vistoria_sintomas;

CREATE POLICY "vistoria_sintomas_select" ON public.vistoria_sintomas
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistoria_sintomas_insert" ON public.vistoria_sintomas
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistoria_sintomas_update" ON public.vistoria_sintomas
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "vistoria_sintomas_delete" ON public.vistoria_sintomas
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- vistoria_riscos
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_select"         ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_insert"         ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_update"         ON public.vistoria_riscos;
DROP POLICY IF EXISTS "vistoria_riscos_delete"         ON public.vistoria_riscos;

CREATE POLICY "vistoria_riscos_select" ON public.vistoria_riscos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_riscos_insert" ON public.vistoria_riscos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_riscos_update" ON public.vistoria_riscos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_riscos_delete" ON public.vistoria_riscos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- =============================================================================
-- vistoria_calhas
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_select"         ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_insert"         ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_update"         ON public.vistoria_calhas;
DROP POLICY IF EXISTS "vistoria_calhas_delete"         ON public.vistoria_calhas;

CREATE POLICY "vistoria_calhas_select" ON public.vistoria_calhas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_calhas_insert" ON public.vistoria_calhas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_calhas_update" ON public.vistoria_calhas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

CREATE POLICY "vistoria_calhas_delete" ON public.vistoria_calhas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- =============================================================================
-- yolo_feedback
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"         ON public.yolo_feedback;
DROP POLICY IF EXISTS "yolo_feedback_select"           ON public.yolo_feedback;
DROP POLICY IF EXISTS "yolo_feedback_insert"           ON public.yolo_feedback;
DROP POLICY IF EXISTS "yolo_feedback_update"           ON public.yolo_feedback;
DROP POLICY IF EXISTS "yolo_feedback_delete"           ON public.yolo_feedback;

CREATE POLICY "yolo_feedback_select" ON public.yolo_feedback
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "yolo_feedback_insert" ON public.yolo_feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "yolo_feedback_update" ON public.yolo_feedback
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "yolo_feedback_delete" ON public.yolo_feedback
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- =============================================================================
-- levantamento_analise_ia
-- =============================================================================
DROP POLICY IF EXISTS "isolamento_por_cliente"              ON public.levantamento_analise_ia;
DROP POLICY IF EXISTS "levantamento_analise_ia_select"      ON public.levantamento_analise_ia;
DROP POLICY IF EXISTS "levantamento_analise_ia_insert"      ON public.levantamento_analise_ia;
DROP POLICY IF EXISTS "levantamento_analise_ia_update"      ON public.levantamento_analise_ia;
DROP POLICY IF EXISTS "levantamento_analise_ia_delete"      ON public.levantamento_analise_ia;

CREATE POLICY "levantamento_analise_ia_select" ON public.levantamento_analise_ia
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_analise_ia_insert" ON public.levantamento_analise_ia
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_analise_ia_update" ON public.levantamento_analise_ia
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "levantamento_analise_ia_delete" ON public.levantamento_analise_ia
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));
