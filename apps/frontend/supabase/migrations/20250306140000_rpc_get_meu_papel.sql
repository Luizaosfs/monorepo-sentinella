-- =============================================================================
-- RPC: retorna o papel do usuário logado (fonte da verdade para o front).
-- papeis_usuarios.usuario_id = auth.uid() (igual às políticas RLS).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'     THEN 4
    WHEN 'supervisor' THEN 3
    WHEN 'moderador'  THEN 3
    WHEN 'operador'  THEN 2
    WHEN 'usuario'   THEN 1
    WHEN 'cliente'   THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_meu_papel() IS 'Retorna o papel mais alto do usuário logado (admin > supervisor > operador > usuario). Front usa para menu e redirect.';

-- Para atribuir papel operador a um usuário (usuario_id = auth.users.id):
--   INSERT INTO papeis_usuarios (usuario_id, papel) VALUES ('<uuid do auth.users>', 'operador');
