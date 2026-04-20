-- =============================================================================
-- Corrige RLS: usuário autenticado pode SEMPRE ver os próprios papéis.
-- Sem isso, is_operador() depende de ler papeis_usuarios, mas a política
-- antiga só permitia ver se já fosse admin ou operador (ciclo).
-- =============================================================================

DROP POLICY IF EXISTS "papeis_usuarios_select" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON papeis_usuarios FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_admin()
    OR public.operador_pode_gerir_usuario(usuario_id)
  );

COMMENT ON POLICY "papeis_usuarios_select" ON papeis_usuarios IS 'Ver próprios papéis (usuario_id = auth.uid()); admin vê tudo; operador vê papéis dos usuários do seu cliente.';
