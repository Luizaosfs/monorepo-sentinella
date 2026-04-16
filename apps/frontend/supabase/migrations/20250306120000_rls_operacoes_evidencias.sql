-- =============================================================================
-- RLS — OPERAÇÕES E OPERAÇÃO EVIDÊNCIAS
-- Multi-tenancy: usuários veem apenas dados do seu cliente (cliente_id).
-- Operadores podem atualizar operações onde responsavel_id = seu usuarios.id.
-- Usa auth.uid() cruzado com usuarios.auth_id.
-- Executar após 20250302100000_rls_geral_todas_tabelas.sql (usa usuario_pode_acessar_cliente, is_admin, is_operador).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Função: ID público do usuário logado (usuarios.id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_usuario_public_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_usuario_public_id() IS
  'Retorna o id (PK) do registro em usuarios do usuário autenticado (auth.uid()). Usado em RLS para operador = responsável.';

-- -----------------------------------------------------------------------------
-- 2. OPERACOES — RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: ver operações do seu cliente (ou admin vê todos via usuario_pode_acessar_cliente)
DROP POLICY IF EXISTS "operacoes_select" ON public.operacoes;
CREATE POLICY "operacoes_select" ON public.operacoes
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- INSERT: quem pode acessar o cliente pode criar operação
DROP POLICY IF EXISTS "operacoes_insert" ON public.operacoes;
CREATE POLICY "operacoes_insert" ON public.operacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- UPDATE: admin ou usuário que é o responsável pela operação (ex.: operador)
DROP POLICY IF EXISTS "operacoes_update" ON public.operacoes;
CREATE POLICY "operacoes_update" ON public.operacoes
  FOR UPDATE TO authenticated
  USING (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (
      public.is_admin()
      OR responsavel_id = public.current_usuario_public_id()
    )
  )
  WITH CHECK (
    public.usuario_pode_acessar_cliente(cliente_id)
    AND (
      public.is_admin()
      OR responsavel_id = public.current_usuario_public_id()
    )
  );

-- DELETE: mesmo critério de acesso ao cliente (admin ou dono do cliente)
DROP POLICY IF EXISTS "operacoes_delete" ON public.operacoes;
CREATE POLICY "operacoes_delete" ON public.operacoes
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 3. OPERACAO_EVIDENCIAS — RLS (via operacao.cliente_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.operacao_evidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operacao_evidencias_select" ON public.operacao_evidencias;
CREATE POLICY "operacao_evidencias_select" ON public.operacao_evidencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operacoes o
      WHERE o.id = operacao_evidencias.operacao_id
      AND public.usuario_pode_acessar_cliente(o.cliente_id)
    )
  );

DROP POLICY IF EXISTS "operacao_evidencias_insert" ON public.operacao_evidencias;
CREATE POLICY "operacao_evidencias_insert" ON public.operacao_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.operacoes o
      WHERE o.id = operacao_evidencias.operacao_id
      AND public.usuario_pode_acessar_cliente(o.cliente_id)
    )
  );

DROP POLICY IF EXISTS "operacao_evidencias_update" ON public.operacao_evidencias;
CREATE POLICY "operacao_evidencias_update" ON public.operacao_evidencias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operacoes o
      WHERE o.id = operacao_evidencias.operacao_id
      AND public.usuario_pode_acessar_cliente(o.cliente_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.operacoes o
      WHERE o.id = operacao_evidencias.operacao_id
      AND public.usuario_pode_acessar_cliente(o.cliente_id)
    )
  );

DROP POLICY IF EXISTS "operacao_evidencias_delete" ON public.operacao_evidencias;
CREATE POLICY "operacao_evidencias_delete" ON public.operacao_evidencias
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operacoes o
      WHERE o.id = operacao_evidencias.operacao_id
      AND public.usuario_pode_acessar_cliente(o.cliente_id)
    )
  );
