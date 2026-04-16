-- =============================================================================
-- S01: Neutralizar platform_admin — sem tocar no enum papel_app
--
-- Problema: papel_app contém 'platform_admin' que não deveria ser usado.
-- Tentativa de DROP TYPE falha por ter 15+ policies e 1 função dependentes.
--
-- Estratégia revisada: NÃO remover o valor do enum (impossível sem CASCADE
-- destrutivo). Em vez disso:
--   1. Converter registros platform_admin → admin
--   2. Dropar is_platform_admin()
--   3. Corrigir is_admin() — não verificar platform_admin
--   4. Corrigir get_meu_papel() — não listar platform_admin
--   5. Corrigir sentinela_drone_risk_config policy (dependia de coluna direta)
--
-- O valor 'platform_admin' permanece no enum como entrada morta (dead value).
-- Nenhum usuário terá esse papel; nenhuma função o verificará.
-- =============================================================================

-- ── 1. Converter registros existentes ────────────────────────────────────────
UPDATE public.papeis_usuarios
SET papel = 'admin'::public.papel_app
WHERE papel::text = 'platform_admin';

-- ── 2. Dropar função obsoleta ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_platform_admin();

-- ── 3. Corrigir is_admin() — remover verificação de platform_admin ───────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND pu.papel::text = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true se o usuário logado possui papel admin. Admin é o nível máximo do sistema.';

-- ── 4. Corrigir get_meu_papel() — excluir platform_admin do ranking ───────────
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT LOWER(pu.papel::text)
  FROM public.papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
    AND pu.papel::text != 'platform_admin'   -- ignorar valor legado
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'operador'    THEN 3
    WHEN 'notificador' THEN 2
    WHEN 'usuario'     THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel de maior privilégio do usuário logado (admin > supervisor > operador > notificador > usuario). '
  'O valor legado platform_admin é ignorado — nenhum usuário deve tê-lo.';

-- ── 5. Atualizar comentários de funções relacionadas ─────────────────────────
COMMENT ON FUNCTION public.usuario_pode_acessar_cliente(uuid) IS
  'Retorna true se o usuário logado pode acessar o cliente informado (próprio cliente ou admin).';

-- ── 6. Recriar policy de sentinela_drone_risk_config ─────────────────────────
-- A policy "admin_all_drone_risk_config" referenciava papeis_usuarios.papel
-- diretamente. Substituir por is_admin() para remover a dependência de coluna.
ALTER TABLE public.sentinela_drone_risk_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_drone_risk_config"  ON public.sentinela_drone_risk_config;
DROP POLICY IF EXISTS "drone_risk_config_select"     ON public.sentinela_drone_risk_config;
DROP POLICY IF EXISTS "drone_risk_config_cliente"    ON public.sentinela_drone_risk_config;

CREATE POLICY "admin_all_drone_risk_config" ON public.sentinela_drone_risk_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "drone_risk_config_select" ON public.sentinela_drone_risk_config
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.usuario_pode_acessar_cliente(cliente_id)
  );

-- ── 7. Recriar policy health_log (dropada pela run anterior) ─────────────────
-- Verificar se a tabela existe antes de recriar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_health_log'
  ) THEN
    ALTER TABLE public.system_health_log ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "health_log_admin_leitura" ON public.system_health_log;
    EXECUTE $p$
      CREATE POLICY "health_log_admin_leitura" ON public.system_health_log
        FOR SELECT TO authenticated
        USING (public.is_admin())
    $p$;
  END IF;
END;
$$;
