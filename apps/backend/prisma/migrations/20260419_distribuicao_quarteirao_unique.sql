-- Restaura constraint UNIQUE perdida na migração Supabase → banco local.
-- Necessária para o ON CONFLICT (cliente_id, ciclo, quarteirao) funcionar
-- em POST /quarteiroes/distribuicoes/upsert.

BEGIN;

-- Verificação defensiva — aborta se houver duplicatas
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT cliente_id, ciclo, quarteirao
    FROM distribuicao_quarteirao
    GROUP BY cliente_id, ciclo, quarteirao
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Existem % tuplas (cliente_id, ciclo, quarteirao) duplicadas — resolver antes de aplicar constraint', dup_count;
  END IF;
END $$;

ALTER TABLE distribuicao_quarteirao
  ADD CONSTRAINT distribuicao_quarteirao_cliente_ciclo_quarteirao_key
  UNIQUE (cliente_id, ciclo, quarteirao);

COMMIT;
