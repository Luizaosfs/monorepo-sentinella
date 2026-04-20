-- ============================================================
-- Fix: RLS em unidades_saude para admins multitenancy
-- ============================================================
-- A policy original "unidades_saude_isolamento" usava apenas
-- a relação em `usuarios` (auth_id -> cliente_id). Isso falha
-- para usuários com papel admin que gerenciam múltiplos clientes.
-- Ajustamos para usar a função padrão:
--   public.usuario_pode_acessar_cliente(cliente_id)
-- (que considera admin via papeis_usuarios e também o próprio cliente)

DROP POLICY IF EXISTS "unidades_saude_isolamento" ON unidades_saude;

-- SELECT: usuário/admin enxerga apenas o que pode acessar
CREATE POLICY "unidades_saude_isolamento" ON unidades_saude FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- INSERT: aplica a mesma regra no WITH CHECK
CREATE POLICY "unidades_saude_insert" ON unidades_saude FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- UPDATE: restringe tanto USING quanto WITH CHECK
CREATE POLICY "unidades_saude_update" ON unidades_saude FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- DELETE (opcional, mas mantém consistência)
CREATE POLICY "unidades_saude_delete" ON unidades_saude FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

