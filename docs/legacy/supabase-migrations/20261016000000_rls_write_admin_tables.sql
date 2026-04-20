-- =============================================================================
-- 20261016000000 — Restringir writes em tabelas administrativas por papel
--
-- PROBLEMA: regioes e planejamentos permitiam INSERT/UPDATE/DELETE para
-- qualquer usuário autenticado do tenant (agentes, notificadores incluídos).
-- SELECT permanece aberto a todos no tenant via usuario_pode_acessar_cliente().
--
-- CORREÇÃO: writes exigem is_admin() OR is_supervisor().
-- Leitura inalterada — todo usuário do tenant pode consultar regiões/planejamentos.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- REGIOES
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "regioes_insert" ON public.regioes;
CREATE POLICY "regioes_insert" ON public.regioes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

DROP POLICY IF EXISTS "regioes_update" ON public.regioes;
CREATE POLICY "regioes_update" ON public.regioes
  FOR UPDATE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  )
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

DROP POLICY IF EXISTS "regioes_delete" ON public.regioes;
CREATE POLICY "regioes_delete" ON public.regioes
  FOR DELETE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANEJAMENTOS
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "planejamento_insert" ON public.planejamento;
CREATE POLICY "planejamento_insert" ON public.planejamento
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

DROP POLICY IF EXISTS "planejamento_update" ON public.planejamento;
CREATE POLICY "planejamento_update" ON public.planejamento
  FOR UPDATE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  )
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

DROP POLICY IF EXISTS "planejamento_delete" ON public.planejamento;
CREATE POLICY "planejamento_delete" ON public.planejamento
  FOR DELETE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- CASOS_NOTIFICADOS — reforçar DELETE para admin/supervisor apenas
-- (INSERT já está restrito a notificador/admin/supervisor pela migration m08)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "casos_notificados_delete" ON public.casos_notificados;
CREATE POLICY "casos_notificados_delete" ON public.casos_notificados
  FOR DELETE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (public.is_admin() OR public.is_supervisor())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('regioes', 'planejamento', 'casos_notificados')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  IF v_count < 7 THEN
    RAISE EXCEPTION
      'FALHA: esperado >= 7 políticas de escrita, encontrado %', v_count;
  END IF;

  RAISE NOTICE
    '20261016000000 — OK. % políticas de escrita com restrição de papel em regioes/planejamento/casos_notificados.',
    v_count;
END;
$$;
