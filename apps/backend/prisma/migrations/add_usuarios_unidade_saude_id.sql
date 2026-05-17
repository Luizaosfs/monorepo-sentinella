-- Vínculo notificador -> unidade de saúde (1-1).
-- Coluna nullable no banco; obrigatoriedade enforçada na aplicação (Zod/use-case)
-- apenas para o papel 'notificador'. Idempotente.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS unidade_saude_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_unidade_saude_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_unidade_saude_id_fkey
      FOREIGN KEY (unidade_saude_id)
      REFERENCES public.unidades_saude (id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuarios_unidade_saude_id_idx
  ON public.usuarios (unidade_saude_id);

-- Backfill: para cada cliente que possui EXATAMENTE 1 unidade de saúde ativa,
-- vincular automaticamente todos os notificadores ainda sem unidade.
-- Notificadores cujos clientes têm 0 ou >1 unidades ficam NULL e serão
-- corrigidos manualmente ao editar o usuário no formulário.
WITH cliente_unica_unidade AS (
  -- HAVING COUNT(*) = 1 garante exatamente uma unidade; array_agg evita
  -- depender de min(uuid)/max(uuid) (funções inexistentes no Postgres).
  SELECT cliente_id, (array_agg(id))[1] AS unidade_id
  FROM public.unidades_saude
  WHERE ativo = true AND deleted_at IS NULL
  GROUP BY cliente_id
  HAVING COUNT(*) = 1
)
UPDATE public.usuarios u
SET unidade_saude_id = c.unidade_id
FROM cliente_unica_unidade c
WHERE u.cliente_id = c.cliente_id
  AND u.unidade_saude_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.papeis_usuarios p
    WHERE p.usuario_id = u.auth_id AND p.papel = 'notificador'
  );
