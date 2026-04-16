-- =============================================================================
-- ATENDIMENTOS E EVIDÊNCIAS
-- 1. Tabela operacao_evidencias (fotos Antes/Depois).
-- 2. Coluna levantamentos.tipo_entrada ('DRONE' | 'MANUAL').
-- Executar após as migrações de RLS existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tipo enum para tipo_entrada do levantamento (opcional; pode ser text)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_entrada_levantamento') THEN
    CREATE TYPE public.tipo_entrada_levantamento AS ENUM ('DRONE', 'MANUAL');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Coluna tipo_entrada em levantamentos
-- -----------------------------------------------------------------------------
ALTER TABLE public.levantamentos
  ADD COLUMN IF NOT EXISTS tipo_entrada text;

COMMENT ON COLUMN public.levantamentos.tipo_entrada IS
  'Origem do levantamento: DRONE ou MANUAL (avulso). Pode ser usado como TEXT ou via cast do enum tipo_entrada_levantamento.';

-- Valor padrão para registros existentes (opcional)
-- UPDATE public.levantamentos SET tipo_entrada = 'DRONE' WHERE tipo_entrada IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Tabela operacao_evidencias
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operacao_evidencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL,
  image_url text NOT NULL,
  legenda text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operacao_evidencias_pkey PRIMARY KEY (id),
  CONSTRAINT operacao_evidencias_operacao_id_fkey FOREIGN KEY (operacao_id)
    REFERENCES public.operacoes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_operacao_evidencias_operacao_id
  ON public.operacao_evidencias(operacao_id);

COMMENT ON TABLE public.operacao_evidencias IS
  'Evidências fotográficas (Antes/Depois) anexadas pelo operador ao encerrar uma operação.';
