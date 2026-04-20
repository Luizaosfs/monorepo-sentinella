-- =============================================================================
-- 1) Adiciona valor 'operador' ao enum papel_app (o enum só tinha admin, supervisor, usuario).
-- 2) Atribui papel operador ao usuário luizantoniooliveira.1001@gmail.com
-- Execute no SQL Editor do Supabase em ordem.
-- =============================================================================

-- Passo 1: adicionar 'operador' ao enum (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'papel_app' AND e.enumlabel = 'operador'
  ) THEN
    ALTER TYPE public.papel_app ADD VALUE 'operador';
  END IF;
END$$;

-- Passo 2: inserir papel operador para o usuário
INSERT INTO public.papeis_usuarios (usuario_id, papel)
SELECT u.auth_id, 'operador'::public.papel_app
FROM public.usuarios u
WHERE u.email = 'luizantoniooliveira.1001@gmail.com'
  AND u.auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = u.auth_id AND LOWER(pu.papel::text) = 'operador'
  );
