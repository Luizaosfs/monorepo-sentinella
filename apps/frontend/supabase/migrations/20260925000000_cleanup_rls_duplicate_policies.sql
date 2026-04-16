-- ============================================================
-- CLEANUP-RLS-01: Remover policies duplicadas/legadas de
--   usuarios e papeis_usuarios que sobreviveram a migrações anteriores.
-- Contexto: policies permissivas da mesma operação fazem OR no Postgres,
--   tornando o conjunto difícil de auditar e potencialmente frágil.
-- A migration 20260924000000 criou o conjunto canônico;
--   esta remove os aliases que não foram dropados naquela rodada.
-- ============================================================

BEGIN;

-- ============================================================
-- usuarios — aliases e duplicatas legadas
-- ============================================================

-- Variante _admin e _admin_supervisor (geradas por migrações intermediárias)
DROP POLICY IF EXISTS "usuarios_delete"                   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin"             ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin_supervisor"  ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin_supervisor"  ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"               ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_proprio"           ON public.usuarios;

-- Garantir que a policy de DELETE canônica existe
-- (20260924 não a recriou explicitamente — mantemos a herança segura)
DROP POLICY IF EXISTS "usuarios_delete_canonical" ON public.usuarios;
CREATE POLICY "usuarios_delete_canonical" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );

-- Garantir que UPDATE own (usuário edita o próprio row) ainda existe
-- (pode ter sido dropada junto com aliases acima)
DROP POLICY IF EXISTS "usuarios_update_self" ON public.usuarios;
CREATE POLICY "usuarios_update_self" ON public.usuarios
  FOR UPDATE TO authenticated
  USING  (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- ============================================================
-- papeis_usuarios — aliases e duplicatas legadas
-- ============================================================

DROP POLICY IF EXISTS "papeis_usuarios_delete_admin"            ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_insert_admin_supervisor" ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_update_admin_supervisor" ON public.papeis_usuarios;
DROP POLICY IF EXISTS "papeis_usuarios_select_cliente"          ON public.papeis_usuarios;
DROP POLICY IF EXISTS "Usuarios leem seus proprios papeis"      ON public.papeis_usuarios;

-- ============================================================
-- Resultado esperado após esta migration:
--
-- usuarios:
--   usuarios_select              (SELECT — próprio | admin | supervisor)
--   usuarios_insert              (INSERT — admin | supervisor)
--   usuarios_update              (UPDATE — admin | supervisor)
--   usuarios_update_self         (UPDATE — próprio row)
--   usuarios_delete_canonical    (DELETE — admin | supervisor)
--
-- papeis_usuarios:
--   papeis_usuarios_select       (SELECT — próprio | admin | supervisor)
--   papeis_usuarios_insert       (INSERT — admin | supervisor com papel_permitido)
--   papeis_usuarios_update       (UPDATE — admin | supervisor com papel_permitido)
--   papeis_usuarios_delete       (DELETE — admin | supervisor)
-- ============================================================

COMMIT;
