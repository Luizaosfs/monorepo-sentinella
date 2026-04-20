-- P7.11 — RPC atômica para troca de papel de usuário
-- Substitui o padrão DELETE + INSERT não-atômico em papeis_usuarios.
-- Chamada: api.usuarios.setPapel() em AdminUsuarios e OperadorUsuarios.
--
-- Parâmetros:
--   p_auth_id : auth.uid() do usuário (papeis_usuarios.usuario_id = auth.uid())
--   p_papel   : novo papel a ser atribuído (ex: 'agente', 'supervisor', 'admin')

CREATE OR REPLACE FUNCTION public.rpc_set_papel_usuario(
  p_auth_id uuid,
  p_papel   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validação básica: bloqueia valores proibidos pelo domínio
  IF p_papel NOT IN ('agente', 'supervisor', 'admin', 'notificador', 'analista_regional') THEN
    RAISE EXCEPTION 'papel_invalido: % não é um papel permitido', p_papel;
  END IF;

  -- Operação atômica: remove papéis anteriores e insere o novo
  DELETE FROM public.papeis_usuarios WHERE usuario_id = p_auth_id;
  INSERT INTO public.papeis_usuarios (usuario_id, papel)
  VALUES (p_auth_id, lower(trim(p_papel)));
END;
$$;

-- Apenas roles autenticados e service_role podem executar
REVOKE ALL ON FUNCTION public.rpc_set_papel_usuario(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_papel_usuario(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_set_papel_usuario IS
  'Troca atomicamente o papel de um usuário em papeis_usuarios. '
  'Substitui o padrão DELETE+INSERT não-atômico do frontend. '
  'Valida que o papel seja um dos valores canônicos permitidos.';
