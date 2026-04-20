-- =============================================================================
-- P5: Analista Regional — Helpers de RLS e acesso regional
--
-- 1. get_meu_agrupamento_id()         — retorna agrupamento_id do usuário logado
-- 2. analista_pode_acessar_cliente()  — verifica se o cliente está no agrupamento
-- 3. Atualiza get_meu_papel()         — reconhece analista_regional na hierarquia
-- =============================================================================

-- 1. Helper: retorna agrupamento_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_meu_agrupamento_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT agrupamento_id
  FROM public.usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_meu_agrupamento_id() TO authenticated;

-- 2. Helper: o analista_regional logado pode ver este cliente?
CREATE OR REPLACE FUNCTION public.analista_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.agrupamento_cliente ac
    JOIN   public.usuarios u ON u.agrupamento_id = ac.agrupamento_id
    WHERE  u.auth_id   = auth.uid()
      AND  ac.cliente_id = p_cliente_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.analista_pode_acessar_cliente(uuid) TO authenticated;

-- 3. Atualizar get_meu_papel() para incluir analista_regional na hierarquia
--    (prioridade 1 — abaixo de todos os papéis municipais, mas reconhecido)
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
    WHEN 'admin'             THEN 5
    WHEN 'supervisor'        THEN 4
    WHEN 'moderador'         THEN 4  -- legado
    WHEN 'agente'            THEN 3
    WHEN 'operador'          THEN 3  -- legado
    WHEN 'notificador'       THEN 2
    WHEN 'analista_regional' THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated, anon;
