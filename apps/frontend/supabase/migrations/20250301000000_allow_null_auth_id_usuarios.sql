-- Permite criar registros em usuarios sem ter ainda um usuário em auth.users.
-- Depois de criar o login em Supabase (Authentication > Users), edite o usuário
-- no app e cole o Auth UID para vincular.
ALTER TABLE usuarios
  ALTER COLUMN auth_id DROP NOT NULL;
