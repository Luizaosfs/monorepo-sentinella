-- Converte gravidas, idosos, criancas_7anos de boolean para integer

ALTER TABLE vistorias ALTER COLUMN gravidas DROP DEFAULT;
ALTER TABLE vistorias ALTER COLUMN idosos DROP DEFAULT;
ALTER TABLE vistorias ALTER COLUMN criancas_7anos DROP DEFAULT;

ALTER TABLE vistorias
  ALTER COLUMN gravidas       TYPE integer USING CASE WHEN gravidas       THEN 1 ELSE 0 END,
  ALTER COLUMN idosos         TYPE integer USING CASE WHEN idosos         THEN 1 ELSE 0 END,
  ALTER COLUMN criancas_7anos TYPE integer USING CASE WHEN criancas_7anos THEN 1 ELSE 0 END;

ALTER TABLE vistorias
  ALTER COLUMN gravidas       SET DEFAULT 0,
  ALTER COLUMN idosos         SET DEFAULT 0,
  ALTER COLUMN criancas_7anos SET DEFAULT 0;
