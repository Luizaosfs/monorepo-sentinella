-- =============================================================================
-- sla_erros_criacao: coluna cliente_id + trigger
--
-- Sintoma: GET /rest/v1/sla_erros_criacao?select=...,run_id&cliente_id=eq.... → 400
-- A tabela original só tinha (id, levantamento_item_id, erro, criado_em).
-- A API filtrava por cliente_id e pedia run_id — colunas inexistentes.
--
-- Correção: cliente_id para multitenancy e filtro PostgREST; run_id removido da API.
-- =============================================================================

ALTER TABLE public.sla_erros_criacao
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sla_erros_criacao_cliente
  ON public.sla_erros_criacao (cliente_id)
  WHERE cliente_id IS NOT NULL;

COMMENT ON COLUMN public.sla_erros_criacao.cliente_id IS
  'Prefeitura do item; preenchido pelo trigger e backfill para filtro RLS/API.';

-- Backfill a partir do levantamento do item
UPDATE public.sla_erros_criacao e
SET cliente_id = l.cliente_id
FROM public.levantamento_itens li
JOIN public.levantamentos l ON l.id = li.levantamento_id
WHERE e.levantamento_item_id = li.id
  AND e.cliente_id IS NULL
  AND l.cliente_id IS NOT NULL;

-- Trigger: gravar cliente_id no log de erro
CREATE OR REPLACE FUNCTION public.trg_levantamento_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_horas       int;
  v_inicio      timestamptz;
  v_prazo_final timestamptz;
  v_prior       text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  v_prior := COALESCE(NULLIF(trim(NEW.prioridade), ''), 'Média');

  IF NOT public.levantamento_item_prioridade_elegivel_sla_auto(v_prior) THEN
    RETURN NEW;
  END IF;

  SELECT l.cliente_id INTO v_cliente_id
  FROM public.levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
    v_config := public.sla_resolve_config(v_cliente_id, NULL);
    v_horas  := COALESCE(
      public.sla_horas_from_config(v_config, v_prior),
      24
    );
  END IF;

  v_inicio := now();

  BEGIN
    v_prazo_final := public.sla_calcular_prazo_final(
      v_inicio,
      v_horas,
      public.sla_resolve_config(v_cliente_id, NULL),
      v_cliente_id
    );
  EXCEPTION WHEN undefined_function THEN
    v_prazo_final := v_inicio + (v_horas || ' hours')::interval;
  END;

  INSERT INTO public.sla_operacional (
    levantamento_item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id,
    v_cliente_id,
    v_prior,
    v_horas,
    v_inicio,
    v_prazo_final,
    'pendente'
  );

  RETURN NEW;

EXCEPTION WHEN others THEN
  BEGIN
    INSERT INTO public.sla_erros_criacao (levantamento_item_id, erro, cliente_id)
    VALUES (
      NEW.id,
      SQLERRM,
      COALESCE(
        v_cliente_id,
        (SELECT l2.cliente_id FROM public.levantamentos l2 WHERE l2.id = NEW.levantamento_id)
      )
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'SLA não criado para levantamento_item % e log falhou: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
