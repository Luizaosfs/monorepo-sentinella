-- ─────────────────────────────────────────────────────────────────────────────
-- D-05: RLS restritiva para papel notificador em casos_notificados
-- Notificador pode INSERT (qualquer) e UPDATE apenas nos seus próprios casos.
-- Admin e supervisor podem UPDATE em qualquer caso do cliente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove a política única existente (SELECT/INSERT/UPDATE/DELETE por cliente_id)
DROP POLICY IF EXISTS "casos_notificados_isolamento" ON casos_notificados;

-- SELECT: todos do cliente (mantém comportamento original)
CREATE POLICY "casos_notificados_select" ON casos_notificados
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
  );

-- INSERT: qualquer usuário do cliente (notificador, admin, supervisor)
CREATE POLICY "casos_notificados_insert" ON casos_notificados
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
  );

-- UPDATE: admin/supervisor podem tudo; notificador só edita os próprios casos
CREATE POLICY "casos_notificados_update" ON casos_notificados
  FOR UPDATE TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
    AND (
      -- Admin ou supervisor: acesso total dentro do cliente
      EXISTS (
        SELECT 1 FROM usuarios
        JOIN papeis_usuarios pu ON pu.usuario_id = usuarios.auth_id
        WHERE auth_id = auth.uid()
          AND pu.papel IN ('admin', 'supervisor')
      )
      OR
      -- Notificador: apenas os próprios casos
      notificador_id IN (
        SELECT id FROM usuarios WHERE auth_id = auth.uid()
      )
    )
  );

-- DELETE: somente admin
CREATE POLICY "casos_notificados_delete" ON casos_notificados
  FOR DELETE TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM usuarios
      JOIN papeis_usuarios pu ON pu.usuario_id = usuarios.auth_id
      WHERE auth_id = auth.uid()
        AND pu.papel = 'admin'
    )
  );
