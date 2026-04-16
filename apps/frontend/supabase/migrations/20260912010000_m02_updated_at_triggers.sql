-- =============================================================================
-- M02: Garantir updated_at + trigger em tabelas que faltam
--
-- Estratégia:
--   1. Criar fn_set_updated_at() genérica (se não existir)
--   2. ADD COLUMN updated_at onde falta
--   3. Criar triggers via DO block para cada tabela
-- =============================================================================

-- ── Função genérica de updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_updated_at() IS
  'M02: Trigger genérico BEFORE UPDATE — mantém updated_at sincronizado.';

-- ── Adicionar updated_at onde a coluna ainda não existe ───────────────────────
ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.levantamentos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quarteiroes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.plano_acao_catalogo
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.score_config
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.territorio_score
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── Criar triggers para cada tabela (idempotente) ────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'focos_risco',
    'levantamento_itens',
    'levantamentos',
    'planejamento',
    'quarteiroes',
    'regioes',
    'plano_acao_catalogo',
    'score_config',
    'territorio_score'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();',
      t
    );
  END LOOP;
END;
$$;
