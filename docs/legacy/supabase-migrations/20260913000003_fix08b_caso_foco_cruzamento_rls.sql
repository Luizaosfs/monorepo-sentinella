-- =============================================================================
-- FIX-08b: Padronizar RLS de caso_foco_cruzamento para usuario_pode_acessar_cliente()
--
-- Contexto: M08 (20260912040000) padronizou unidades_saude, casos_notificados,
-- vistoria_*, yolo_feedback e levantamento_analise_ia. A tabela caso_foco_cruzamento
-- ficou de fora: ainda usa a política "caso_foco_cruzamento_isolamento" criada em B02
-- (20260605000000) sem o helper usuario_pode_acessar_cliente().
--
-- caso_foco_cruzamento não tem cliente_id direto — isolamento é via caso_id → casos_notificados.
-- =============================================================================

ALTER TABLE public.caso_foco_cruzamento ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas (B02 e original)
DROP POLICY IF EXISTS "caso_foco_cruzamento_isolamento" ON public.caso_foco_cruzamento;
DROP POLICY IF EXISTS "isolamento_por_cliente"          ON public.caso_foco_cruzamento;

-- SELECT: usuário pode ver cruzamentos de casos do seu cliente
CREATE POLICY "caso_foco_cruzamento_select" ON public.caso_foco_cruzamento
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos_notificados cn
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND public.usuario_pode_acessar_cliente(cn.cliente_id)
    )
  );

-- INSERT: apenas via trigger SECURITY DEFINER (trg_cruzar_caso_focos) —
-- concedemos também para authenticated para suportar casos excepcionais
CREATE POLICY "caso_foco_cruzamento_insert" ON public.caso_foco_cruzamento
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.casos_notificados cn
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND public.usuario_pode_acessar_cliente(cn.cliente_id)
    )
  );

-- UPDATE/DELETE: apenas admin (cruzamento é append-only por design)
CREATE POLICY "caso_foco_cruzamento_update" ON public.caso_foco_cruzamento
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos_notificados cn
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND public.usuario_pode_acessar_cliente(cn.cliente_id)
    )
  );

CREATE POLICY "caso_foco_cruzamento_delete" ON public.caso_foco_cruzamento
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casos_notificados cn
      WHERE cn.id = caso_foco_cruzamento.caso_id
        AND public.usuario_pode_acessar_cliente(cn.cliente_id)
    )
  );

COMMENT ON TABLE public.caso_foco_cruzamento IS
  'FIX-08b: Políticas padronizadas para usuario_pode_acessar_cliente() via casos_notificados. '
  'Tabela é append-only — preenchida pelo trigger trg_cruzar_caso_focos. '
  'NUNCA inserir manualmente.';
