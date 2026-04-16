-- ─────────────────────────────────────────────────────────────────────────────
-- A-03: Integrar sla_calcular_prazo_final no trigger de auto-SLA de
--       levantamento_itens, para descontar feriados e horário comercial.
-- ─────────────────────────────────────────────────────────────────────────────

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
BEGIN
  -- Idempotência: não cria se já existe SLA aberto
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE levantamento_item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve cliente via levantamento
  SELECT l.cliente_id INTO v_cliente_id
  FROM public.levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcula horas base
  IF NEW.sla_horas IS NOT NULL AND NEW.sla_horas >= 1 THEN
    v_horas := NEW.sla_horas;
  ELSE
    SELECT c.config INTO v_config
    FROM public.sla_config c
    WHERE c.cliente_id = v_cliente_id
    LIMIT 1;
    v_horas := COALESCE(
      public.sla_horas_from_config(v_config, COALESCE(NEW.prioridade, 'Média')),
      24
    );
  END IF;

  v_inicio := now();

  -- A-03: usa sla_calcular_prazo_final para descontar feriados/horário comercial
  -- Fallback para now() + interval caso a função não exista (upgrades graduais)
  BEGIN
    v_prazo_final := public.sla_calcular_prazo_final(v_inicio, v_horas, v_cliente_id);
  EXCEPTION WHEN undefined_function THEN
    v_prazo_final := v_inicio + (v_horas || ' hours')::interval;
  END;

  INSERT INTO public.sla_operacional (
    levantamento_item_id, cliente_id, prioridade, sla_horas, inicio, prazo_final, status
  ) VALUES (
    NEW.id,
    v_cliente_id,
    COALESCE(NEW.prioridade, 'Média'),
    v_horas,
    v_inicio,
    v_prazo_final,
    'pendente'
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_levantamento_item_criar_sla_auto() IS
  'A-03: usa sla_calcular_prazo_final (desconta feriados e horário comercial). '
  'Fallback para now()+interval se a função de feriados não existir.';
