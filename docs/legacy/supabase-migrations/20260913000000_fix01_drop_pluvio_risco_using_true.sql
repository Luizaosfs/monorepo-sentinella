-- =============================================================================
-- FIX-01: DROP políticas USING(true) legadas de pluvio_risco
--
-- Problema: PostgreSQL com múltiplas políticas PERMISSIVE faz OR —
-- qualquer política USING(true) anula todas as outras e vaza dados entre tenants.
-- As políticas corretas (pluvio_risco_select/insert/update/delete) foram criadas
-- em 20250302100000_rls_geral_todas_tabelas.sql mas as antigas com nomes diferentes
-- nunca foram explicitamente dropadas.
-- =============================================================================

-- Dropar políticas legadas por nome antigo (USING(true) implícito)
DROP POLICY IF EXISTS "select_pluvio_risco" ON public.pluvio_risco;
DROP POLICY IF EXISTS "insert_pluvio_risco" ON public.pluvio_risco;
DROP POLICY IF EXISTS "update_pluvio_risco" ON public.pluvio_risco;
DROP POLICY IF EXISTS "delete_pluvio_risco" ON public.pluvio_risco;

-- Dropar também variantes com nomes genéricos que podem existir
DROP POLICY IF EXISTS "isolamento_por_cliente" ON public.pluvio_risco;
DROP POLICY IF EXISTS "pluvio_risco_acesso" ON public.pluvio_risco;

-- Garantir RLS habilitado
ALTER TABLE public.pluvio_risco ENABLE ROW LEVEL SECURITY;

-- Recriar políticas corretas se não existirem (idempotente)
-- As políticas padrão usam EXISTS via regioes.cliente_id (pluvio_risco não tem cliente_id direto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pluvio_risco' AND policyname = 'pluvio_risco_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "pluvio_risco_select" ON public.pluvio_risco
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.regioes r
            WHERE r.id = pluvio_risco.regiao_id
              AND public.usuario_pode_acessar_cliente(r.cliente_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pluvio_risco' AND policyname = 'pluvio_risco_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "pluvio_risco_insert" ON public.pluvio_risco
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.regioes r
            WHERE r.id = pluvio_risco.regiao_id
              AND public.usuario_pode_acessar_cliente(r.cliente_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pluvio_risco' AND policyname = 'pluvio_risco_update'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "pluvio_risco_update" ON public.pluvio_risco
        FOR UPDATE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.regioes r
            WHERE r.id = pluvio_risco.regiao_id
              AND public.usuario_pode_acessar_cliente(r.cliente_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.regioes r
            WHERE r.id = pluvio_risco.regiao_id
              AND public.usuario_pode_acessar_cliente(r.cliente_id)
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pluvio_risco' AND policyname = 'pluvio_risco_delete'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "pluvio_risco_delete" ON public.pluvio_risco
        FOR DELETE TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.regioes r
            WHERE r.id = pluvio_risco.regiao_id
              AND public.usuario_pode_acessar_cliente(r.cliente_id)
          )
        )
    $p$;
  END IF;
END $$;

COMMENT ON TABLE public.pluvio_risco IS
  'FIX-01: Políticas legadas USING(true) removidas. '
  'Isolamento via regioes.cliente_id → usuario_pode_acessar_cliente().';
