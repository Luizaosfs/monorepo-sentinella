-- =============================================================================
-- Simplificação do RLS de sla_operacional
--
-- PRÉ-REQUISITO: SELECT COUNT(*) FROM sla_operacional WHERE cliente_id IS NULL;
--                Resultado: 0 registros (confirmado em 12/04/2026)
--
-- TIPO:          Refatoração técnica
-- RISCO:         Baixo
-- IMPACTO:       Backend (performance)
--
-- Remove 3 policies legadas redundantes e simplifica 4 policies modernas.
-- Nenhuma regra de negócio alterada. Nenhuma mudança de estrutura.
-- =============================================================================

BEGIN;

-- ── Validação defensiva ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_nulls integer;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.sla_operacional
  WHERE cliente_id IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION
      'ABORTANDO: % registro(s) com cliente_id NULL em sla_operacional. '
      'Execute o backfill antes de aplicar esta migration.',
      v_nulls;
  END IF;

  RAISE NOTICE 'Validação OK: 0 registros com cliente_id NULL.';
END;
$$;

-- ── Remover policies legadas ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read own client sla" ON public.sla_operacional;
DROP POLICY IF EXISTS "Operadores update own sla" ON public.sla_operacional;
DROP POLICY IF EXISTS "Admins full access sla" ON public.sla_operacional;

-- ── Substituir policies modernas (remover fallback e IS NOT NULL) ─────────────

DROP POLICY IF EXISTS "sla_operacional_select" ON public.sla_operacional;

CREATE POLICY "sla_operacional_select"
ON public.sla_operacional
FOR SELECT
TO authenticated
USING (
  public.usuario_pode_acessar_cliente(cliente_id)
);

DROP POLICY IF EXISTS "sla_operacional_insert" ON public.sla_operacional;

CREATE POLICY "sla_operacional_insert"
ON public.sla_operacional
FOR INSERT
TO authenticated
WITH CHECK (
  public.usuario_pode_acessar_cliente(cliente_id)
);

DROP POLICY IF EXISTS "sla_operacional_update" ON public.sla_operacional;

CREATE POLICY "sla_operacional_update"
ON public.sla_operacional
FOR UPDATE
TO authenticated
USING (
  public.usuario_pode_acessar_cliente(cliente_id)
)
WITH CHECK (
  public.usuario_pode_acessar_cliente(cliente_id)
);

DROP POLICY IF EXISTS "sla_operacional_delete" ON public.sla_operacional;

CREATE POLICY "sla_operacional_delete"
ON public.sla_operacional
FOR DELETE
TO authenticated
USING (
  public.usuario_pode_acessar_cliente(cliente_id)
);

-- ── Verificação pós-aplicação ────────────────────────────────────────────────

DO $$
DECLARE
  v_count integer;
  v_names text;
BEGIN
  SELECT COUNT(*), string_agg(policyname, ', ' ORDER BY policyname)
  INTO v_count, v_names
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'sla_operacional';

  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'FALHA: esperava 4 policies em sla_operacional, encontrou %. Policies: [%]',
      v_count, v_names;
  END IF;

  IF v_names LIKE '%Admins full access%'
     OR v_names LIKE '%Operadores update%'
     OR v_names LIKE '%Users read own%' THEN
    RAISE EXCEPTION
      'FALHA: policies legadas ainda presentes: [%]', v_names;
  END IF;

  RAISE NOTICE
    'Verificação OK: % policies ativas em sla_operacional: [%]',
    v_count, v_names;
END;
$$;

COMMIT;
