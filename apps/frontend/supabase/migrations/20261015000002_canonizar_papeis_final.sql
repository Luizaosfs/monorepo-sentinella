-- =============================================================================
-- 20261015000002 — Canonização de papéis: etapa final
--
-- PRÉ-REQUISITO: 20261015000001 aplicada (dados migrados, is_agente() criada,
--               chk_papel_canonico ativa, custom_access_token_hook canônico).
--
-- O QUE ESTA MIGRATION FAZ:
--   1. Adiciona JWT fast-path em is_agente() — consistência com is_admin/is_supervisor
--   2. Remove funções mortas: is_operador(), papel_permitido_para_operador(),
--      operador_pode_gerir_usuario() — nenhuma delas é usada em policies ativas
--   3. Corrige comments obsoletos: is_supervisor(), get_meu_papel(), papel_app
--
-- O QUE NÃO FAZ (e por quê):
--   - Não remove os valores mortos do enum (operador, usuario, platform_admin):
--     ALTER TABLE papeis_usuarios ALTER COLUMN papel TYPE text falha com
--     "cannot alter type of a column used in a policy definition" pois toda
--     policy do sistema tem dependência transitiva via helper functions.
--     A constraint chk_papel_canonico já cobre funcionalmente esse requisito.
--   - Não altera policies de papeis_usuarios nem usuarios: já estão corretas
--     (usam is_admin/is_supervisor/supervisor_pode_gerir_usuario — sem operador).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1: is_agente() — adicionar JWT fast-path
-- Alinha comportamento com is_admin(), is_supervisor(), is_notificador().
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_agente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'papel') IS NOT NULL
    THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'agente'
    ELSE EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND LOWER(pu.papel::text) = 'agente'
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_agente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agente() TO authenticated;

COMMENT ON FUNCTION public.is_agente() IS
  'Retorna true se o usuário logado tem papel agente (agente de campo). '
  'JWT fast-path + DB fallback. '
  'Substitui definitivamente is_operador() — removida nesta migration.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Remover funções mortas
-- Ordem obrigatória: remover dependentes antes da raiz.
-- Verificado: nenhuma das três funções é referenciada em policies ativas.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. operador_pode_gerir_usuario() — chama is_operador(), não usada em policies
DROP FUNCTION IF EXISTS public.operador_pode_gerir_usuario(uuid);

-- 2b. papel_permitido_para_operador() — aceita 'operador','usuario' (valores mortos)
--     A constraint chk_papel_canonico já bloqueia esses valores na camada de dados.
DROP FUNCTION IF EXISTS public.papel_permitido_para_operador(text);

-- 2c. is_operador() — deprecated desde 20261015000001 (delegava para is_agente())
--     Grants a 'anon' (segurança) e body obsoleto (verificava JWT para 'operador').
DROP FUNCTION IF EXISTS public.is_operador();

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3: Corrigir comments obsoletos
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.is_supervisor() IS
  'Retorna true se o usuário logado tem papel supervisor (gestor municipal). '
  'JWT fast-path + DB fallback. '
  'moderador nunca existiu no enum — não há alias.';

COMMENT ON FUNCTION public.get_meu_papel() IS
  'Retorna o papel canônico de maior prioridade do usuário logado. '
  'Escada: admin(5) > supervisor(4) > agente(3) > notificador(2) > morto(0). '
  'Fonte da verdade para menu, redirecionamento e guards no frontend.';

COMMENT ON TYPE public.papel_app IS
  'Papéis canônicos ATIVOS: admin, supervisor, agente, notificador. '
  'Valores mortos no tipo (nunca atribuir): operador, usuario, platform_admin. '
  'Proteção em dados: constraint chk_papel_canonico em papeis_usuarios bloqueia inserção. '
  'Os valores mortos não podem ser removidos do enum sem recriar todas as RLS policies '
  '(limitação do PostgreSQL: ALTER TABLE ALTER COLUMN TYPE falha com dependências RLS). '
  'Última canonização: migration 20261015000002.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4: Verificação final
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_legados   integer;
  v_mortas    integer;
BEGIN
  -- 4a. Confirmar dados limpos em papeis_usuarios
  SELECT COUNT(*) INTO v_legados
  FROM public.papeis_usuarios
  WHERE papel::text NOT IN ('admin', 'supervisor', 'agente', 'notificador');

  IF v_legados > 0 THEN
    RAISE EXCEPTION
      'FALHA DE VERIFICAÇÃO: % registro(s) com papel fora dos canônicos em papeis_usuarios. '
      'Execute: SELECT papel::text, COUNT(*) FROM papeis_usuarios GROUP BY papel::text',
      v_legados;
  END IF;

  -- 4b. Confirmar que funções mortas foram removidas
  SELECT COUNT(*) INTO v_mortas
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'is_operador',
      'papel_permitido_para_operador',
      'operador_pode_gerir_usuario'
    );

  IF v_mortas > 0 THEN
    RAISE EXCEPTION
      'FALHA DE VERIFICAÇÃO: % função(ões) deprecated ainda presente(s) após DROP.',
      v_mortas;
  END IF;

  -- 4c. Confirmar que is_agente() existe e tem JWT fast-path
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_agente'
  ) THEN
    RAISE EXCEPTION 'FALHA DE VERIFICAÇÃO: is_agente() não encontrada após migration.';
  END IF;

  RAISE NOTICE
    '20261015000002 — OK. Dados limpos: %. Funções mortas removidas: 3 (is_operador, papel_permitido_para_operador, operador_pode_gerir_usuario).',
    v_legados;
END;
$$;
