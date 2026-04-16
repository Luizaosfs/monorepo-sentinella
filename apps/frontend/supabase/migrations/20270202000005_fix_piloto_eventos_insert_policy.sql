-- =============================================================================
-- 20270202000005 — C-06: Restringir INSERT em piloto_eventos a papéis canônicos
--
-- PROBLEMA:
--   A policy "piloto_eventos_insert" permitia qualquer usuário autenticado
--   inserir eventos, bastando ter cliente_id válido. Um usuário sem papel
--   (sem linha em papeis_usuarios) conseguia poluir as métricas analíticas.
--
-- CORREÇÃO:
--   Adicionar verificação de que o inseridor tem papel canônico em papeis_usuarios.
--   Papéis aceitos: admin, supervisor, agente, notificador, analista_regional.
--   Continua fire-and-forget — sem overhead adicional significativo pois
--   papeis_usuarios tem índice em usuario_id.
-- =============================================================================

DROP POLICY IF EXISTS "piloto_eventos_insert" ON public.piloto_eventos;

CREATE POLICY "piloto_eventos_insert" ON public.piloto_eventos
  FOR INSERT
  WITH CHECK (
    -- tenant isolation: cliente_id pertence ao usuário
    cliente_id IN (
      SELECT u.cliente_id FROM public.usuarios u WHERE u.auth_id = auth.uid()
    )
    AND
    -- papel canônico: apenas usuários com papel válido instrumentam eventos
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor', 'agente', 'notificador', 'analista_regional')
    )
  );

COMMENT ON POLICY "piloto_eventos_insert" ON public.piloto_eventos IS
  'Permite INSERT somente para usuários autenticados com papel canônico em papeis_usuarios. '
  'Corrige C-06: usuário sem papel não pode poluir métricas analíticas do piloto IA.';
