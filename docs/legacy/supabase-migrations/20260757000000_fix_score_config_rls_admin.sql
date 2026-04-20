-- =============================================================================
-- RLS score_config / territorio_score: admins SaaS sem cliente vinculado
--
-- Sintoma: POST /rest/v1/score_config → 403 Forbidden ao salvar em Admin Score Config.
-- Causa: políticas usavam apenas
--   cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
-- que falha quando usuarios.cliente_id IS NULL (papel admin da equipe Sentinella).
--
-- Correção: public.usuario_pode_acessar_cliente(cliente_id) — mesmo padrão de
-- ciclos, unidades_saude, focos_risco.
-- =============================================================================

DROP POLICY IF EXISTS "score_config_select" ON public.score_config;
DROP POLICY IF EXISTS "score_config_upsert" ON public.score_config;

CREATE POLICY "score_config_select" ON public.score_config
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "score_config_mutate" ON public.score_config
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- Leitura de cache por imóvel (views / API) para admin SaaS
DROP POLICY IF EXISTS "territorio_score_select" ON public.territorio_score;

CREATE POLICY "territorio_score_select" ON public.territorio_score
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));
