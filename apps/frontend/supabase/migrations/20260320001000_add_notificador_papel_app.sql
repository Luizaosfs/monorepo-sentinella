-- Adiciona o papel "notificador" ao enum papel_app, se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'papel_app'
      AND e.enumlabel = 'notificador'
  ) THEN
    ALTER TYPE public.papel_app ADD VALUE 'notificador';
  END IF;
END$$;
