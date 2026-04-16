-- ============================================================
-- Q6 — Onboarding por perfil: persistência no banco
-- Adiciona controle de versão de onboarding em usuarios
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS onboarding_concluido    boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_versao       text,
  ADD COLUMN IF NOT EXISTS onboarding_concluido_em timestamptz;

COMMENT ON COLUMN usuarios.onboarding_concluido    IS 'true quando o usuário completou ou dispensou o tour de onboarding';
COMMENT ON COLUMN usuarios.onboarding_versao       IS 'versão do tour concluído — se diferente da versão atual, exibe novamente';
COMMENT ON COLUMN usuarios.onboarding_concluido_em IS 'timestamp da conclusão do onboarding';
