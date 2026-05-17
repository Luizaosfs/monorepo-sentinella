-- Rollback — Vínculo notificador -> unidade de saúde
--
-- Reverte a migration `prisma/migrations/add_usuarios_unidade_saude_id.sql`.
-- Use em rollback emergencial APÓS reverter o código correspondente
-- (`git revert` dos arquivos do vínculo notificador↔unidade).
--
-- ATENÇÃO: dropar a coluna apaga os vínculos já cadastrados (inclusive
-- o backfill). Idempotente.

DROP INDEX IF EXISTS public.usuarios_unidade_saude_id_idx;

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_unidade_saude_id_fkey;

ALTER TABLE public.usuarios
  DROP COLUMN IF EXISTS unidade_saude_id;
