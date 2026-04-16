-- =============================================================================
-- SC-07: Restringir mutação de score_config a supervisor/admin
--
-- Problema: política "score_config_mutate" FOR ALL usa apenas
-- usuario_pode_acessar_cliente() — qualquer operador ou agente do cliente
-- pode alterar os pesos do score territorial, causando distorções.
--
-- Fix: SELECT continua aberto para todos os usuários do cliente.
--      INSERT/UPDATE/DELETE restrito a papel IN ('admin', 'supervisor').
-- =============================================================================

DROP POLICY IF EXISTS "score_config_mutate" ON public.score_config;

-- SELECT: todos os usuários do cliente (necessário para exibir score em leitura)
-- (política score_config_select já existe com usuario_pode_acessar_cliente — mantida)

-- MUTATE: apenas admin (SaaS) ou supervisor (admin municipal)
CREATE POLICY "score_config_mutate" ON public.score_config
  FOR ALL TO authenticated
  USING (
    usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );
