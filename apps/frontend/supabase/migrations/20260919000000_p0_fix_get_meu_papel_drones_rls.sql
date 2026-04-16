-- ============================================================
-- P0-S1: Corrigir get_meu_papel() — adicionar notificador
-- P0-S2: Corrigir RLS da tabela drones
--        drones NÃO tem cliente_id — é catálogo global de hardware.
--        Correção: SELECT aberto para autenticados (era USING(true) que inclui anônimos);
--        INSERT/UPDATE/DELETE restritos a admin/supervisor.
-- ============================================================

-- ── P0-S1 ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM public.papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY
    CASE LOWER(pu.papel::text)
      WHEN 'admin'        THEN 10
      WHEN 'supervisor'   THEN  7
      WHEN 'moderador'    THEN  7
      WHEN 'notificador'  THEN  3   -- CORREÇÃO: estava ausente, caía no ELSE 0
      WHEN 'operador'     THEN  2
      WHEN 'usuario'      THEN  1
      WHEN 'cliente'      THEN  1
      ELSE 0
    END DESC
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel mais alto do usuário logado. Hierarquia: admin > supervisor = moderador > notificador > operador > usuario = cliente.';

-- ── P0-S2 ───────────────────────────────────────────────────────────────────
-- drones(id, marca, modelo, baterias, proprietario) — sem cliente_id.
-- Problema original: USING(true) permitia acesso anônimo (sem auth).
-- Correção: SELECT exige auth.role() = 'authenticated'; escrita só admin/supervisor.

ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;

-- Remover todas as policies existentes de forma segura
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'drones' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drones', r.policyname);
  END LOOP;
END $$;

-- Leitura: qualquer usuário autenticado (tabela de hardware, sem dados sensíveis)
CREATE POLICY "drones_select_autenticado"
  ON public.drones
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Criação: apenas admin e supervisor
CREATE POLICY "drones_insert_admin_supervisor"
  ON public.drones
  FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_supervisor());

-- Edição: apenas admin e supervisor
CREATE POLICY "drones_update_admin_supervisor"
  ON public.drones
  FOR UPDATE
  USING  (public.is_admin() OR public.is_supervisor())
  WITH CHECK (public.is_admin() OR public.is_supervisor());

-- Remoção: apenas admin
CREATE POLICY "drones_delete_admin"
  ON public.drones
  FOR DELETE
  USING (public.is_admin());
