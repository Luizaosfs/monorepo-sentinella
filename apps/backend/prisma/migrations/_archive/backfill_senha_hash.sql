-- =============================================================================
-- BACKFILL: usuarios.senha_hash ← auth.users.encrypted_password
-- =============================================================================
-- Propósito : Copiar a senha bcrypt de usuários legados (Supabase) para a
--             coluna local, habilitando login sem dependência de auth.users.
-- Idempotente: sim — condição WHERE u.senha_hash IS NULL protege re-execução.
-- Segurança  : NÃO sobrescreve senha_hash já definido.
-- Pré-req    : prisma db push já executado com a coluna senha_hash criada.
-- =============================================================================

-- Passo 1: diagnóstico antes do backfill
SELECT
  COUNT(*)                                                            AS total_usuarios,
  COUNT(*) FILTER (WHERE auth_id IS NULL)                            AS sem_auth_id,
  COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL) AS legados_pendentes,
  COUNT(*) FILTER (WHERE senha_hash IS NOT NULL)                     AS ja_migrados
FROM public.usuarios;

-- Passo 2: backfill (idempotente)
UPDATE public.usuarios u
SET
  senha_hash = au.encrypted_password,
  updated_at = now()
FROM auth.users au
WHERE au.id          = u.auth_id
  AND u.auth_id      IS NOT NULL
  AND u.senha_hash   IS NULL
  AND au.encrypted_password IS NOT NULL;

-- Passo 3: diagnóstico pós-backfill (deve mostrar legados_pendentes = 0)
SELECT
  COUNT(*)                                                            AS total_usuarios,
  COUNT(*) FILTER (WHERE auth_id IS NULL)                            AS sem_auth_id,
  COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL) AS legados_pendentes,
  COUNT(*) FILTER (WHERE senha_hash IS NOT NULL)                     AS ja_migrados
FROM public.usuarios;

-- Passo 4: verificar usuários que ficaram sem senha_hash (auth_id sem correspondência em auth.users)
-- Estes usuários não conseguirão logar até que a senha seja redefinida manualmente.
SELECT u.id, u.email, u.auth_id, u.created_at
FROM public.usuarios u
WHERE u.auth_id IS NOT NULL
  AND u.senha_hash IS NULL;
