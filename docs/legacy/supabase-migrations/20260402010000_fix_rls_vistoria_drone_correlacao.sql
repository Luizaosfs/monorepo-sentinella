-- Corrige a política RLS de vistoria_drone_correlacao para usar a função
-- centralizada usuario_pode_acessar_cliente(), garantindo que admin da
-- plataforma tenha acesso cross-tenant (necessário para AdminYoloQualidade).

DROP POLICY IF EXISTS "corr_isolamento" ON vistoria_drone_correlacao;

CREATE POLICY "corr_isolamento" ON vistoria_drone_correlacao
  FOR ALL
  TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));
