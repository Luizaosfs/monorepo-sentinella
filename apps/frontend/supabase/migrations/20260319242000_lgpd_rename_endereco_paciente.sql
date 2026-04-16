-- ─────────────────────────────────────────────────────────────────────────────
-- GRUPO 3 — LGPD: renomear endereco_paciente → logradouro_bairro
-- A coluna armazena apenas logradouro + número (sem nome, CPF ou identificador).
-- O novo nome deixa claro no schema que não há dado pessoal identificável.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE casos_notificados
  RENAME COLUMN endereco_paciente TO logradouro_bairro;

-- Comentário explícito para futuros DBAs / auditorias LGPD
COMMENT ON COLUMN casos_notificados.logradouro_bairro IS
  'Logradouro e número apenas (ex: Rua das Flores, 100). '
  'Não armazenar nome, CPF, data de nascimento ou qualquer dado pessoal identificável — LGPD Art. 7°.';
