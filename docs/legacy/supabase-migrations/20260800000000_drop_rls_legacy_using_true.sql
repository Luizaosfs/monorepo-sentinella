-- =============================================================================
-- 1A: Remove políticas RLS legadas com USING(true) em planejamento e voos
--
-- As políticas corretas já existem em 20250302100000_rls_geral_todas_tabelas.sql
-- usando usuario_pode_acessar_cliente(). Estas políticas antigas permitem
-- acesso cross-tenant e devem ser removidas.
-- =============================================================================

-- Verificação: confirmar que as políticas corretas existem antes de dropar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'planejamento'
      AND policyname = 'planejamento_select'
      AND qual NOT ILIKE '%true%'
  ) THEN
    RAISE EXCEPTION 'ABORT: planejamento_select correta não encontrada — não é seguro dropar as legadas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'voos'
      AND policyname = 'voos_select'
      AND qual NOT ILIKE '%using (true)%'
  ) THEN
    RAISE EXCEPTION 'ABORT: voos_select correta não encontrada — não é seguro dropar as legadas';
  END IF;
END$$;

-- ── Remover políticas legadas de planejamento ─────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can delete planejamento" ON planejamento;
DROP POLICY IF EXISTS "Authenticated users can insert planejamento" ON planejamento;
DROP POLICY IF EXISTS "Authenticated users can read planejamento"   ON planejamento;
DROP POLICY IF EXISTS "Authenticated users can update planejamento" ON planejamento;

-- ── Remover políticas legadas de voos ─────────────────────────────────────────
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar voos"   ON voos;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir voos"     ON voos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir voos"     ON voos;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar voos"  ON voos;
