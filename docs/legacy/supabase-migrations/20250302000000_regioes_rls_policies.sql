-- Políticas RLS para a tabela regioes
-- Permite que usuários autenticados insiram/atualizem/leiam regiões do cliente ao qual estão vinculados (ou qualquer cliente se forem admin).

-- Ativa RLS na tabela (se ainda não estiver)
ALTER TABLE regioes ENABLE ROW LEVEL SECURITY;

-- Helper: usuário pode acessar um dado cliente_id? (é o seu cliente ou é admin)
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id = auth.uid()
    AND (
      u.cliente_id = p_cliente_id
      OR EXISTS (
        SELECT 1 FROM papeis_usuarios pu
        WHERE pu.usuario_id = u.auth_id AND pu.papel = 'admin'
      )
    )
  );
$$;

-- SELECT: ver regiões dos clientes que o usuário pode acessar
DROP POLICY IF EXISTS "regioes_select" ON regioes;
CREATE POLICY "regioes_select" ON regioes
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- INSERT: inserir apenas para clientes que o usuário pode acessar
DROP POLICY IF EXISTS "regioes_insert" ON regioes;
CREATE POLICY "regioes_insert" ON regioes
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- UPDATE: atualizar apenas regiões de clientes que o usuário pode acessar
DROP POLICY IF EXISTS "regioes_update" ON regioes;
CREATE POLICY "regioes_update" ON regioes
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- DELETE: excluir apenas regiões de clientes que o usuário pode acessar
DROP POLICY IF EXISTS "regioes_delete" ON regioes;
CREATE POLICY "regioes_delete" ON regioes
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));
