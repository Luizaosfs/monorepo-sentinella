-- P4: Centralizar filtro deleted_at no RLS
-- Usa políticas RESTRICTIVE para garantir que registros soft-deleted nunca
-- apareçam para usuários comuns, independente do frontend chamar .is('deleted_at', null).
-- Admins de plataforma continuam vendo tudo (para auditoria).
--
-- Estratégia: RESTRICTIVE policy = combina com AND sobre todas as permissive policies.
-- Não precisa conhecer os nomes das políticas existentes.

-- ── focos_risco ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rls_bloquear_deletados_focos_risco" ON public.focos_risco;
CREATE POLICY "rls_bloquear_deletados_focos_risco"
  ON public.focos_risco
  AS RESTRICTIVE
  FOR SELECT
  USING (
    deleted_at IS NULL
    OR public.is_admin()
  );

-- ── casos_notificados ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rls_bloquear_deletados_casos_notificados" ON public.casos_notificados;
CREATE POLICY "rls_bloquear_deletados_casos_notificados"
  ON public.casos_notificados
  AS RESTRICTIVE
  FOR SELECT
  USING (
    deleted_at IS NULL
    OR public.is_admin()
  );

-- ── levantamento_itens ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rls_bloquear_deletados_levantamento_itens" ON public.levantamento_itens;
CREATE POLICY "rls_bloquear_deletados_levantamento_itens"
  ON public.levantamento_itens
  AS RESTRICTIVE
  FOR SELECT
  USING (
    deleted_at IS NULL
    OR public.is_admin()
  );

-- ── vistorias (soft delete adicionado em QW-10D) ──────────────────────────────

DROP POLICY IF EXISTS "rls_bloquear_deletados_vistorias" ON public.vistorias;
CREATE POLICY "rls_bloquear_deletados_vistorias"
  ON public.vistorias
  AS RESTRICTIVE
  FOR SELECT
  USING (
    deleted_at IS NULL
    OR public.is_admin()
  );

-- ── imoveis (soft delete adicionado em QW-10D) ────────────────────────────────

DROP POLICY IF EXISTS "rls_bloquear_deletados_imoveis" ON public.imoveis;
CREATE POLICY "rls_bloquear_deletados_imoveis"
  ON public.imoveis
  AS RESTRICTIVE
  FOR SELECT
  USING (
    deleted_at IS NULL
    OR public.is_admin()
  );
