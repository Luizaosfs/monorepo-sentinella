-- ─────────────────────────────────────────────────────────────────────────────
-- SLA automático em levantamento_item: apenas bandas P1 / P2 / P3.
-- Exclui P4, P5 e equivalentes textuais (Baixa, Monitoramento).
-- Prioridade NULL ou vazia continua tratada como Média (P3) — mesmo comportamento anterior.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.levantamento_item_prioridade_elegivel_sla_auto(p_prioridade text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(p_prioridade, ''))) IN (
    'p1', 'p2', 'p3',
    'crítica', 'critica', 'crítico', 'critico', 'urgente',
    'alta',
    'média', 'media', 'moderada', 'moderado'
  );
$$;

COMMENT ON FUNCTION public.levantamento_item_prioridade_elegivel_sla_auto(text) IS
  'True se a prioridade do item está em P1/P2/P3 (códigos Drone) ou nos rótulos legados equivalentes '
  '(Crítica/Urgente/Crítico, Alta, Média/Moderada). False para P4/P5, Baixa e Monitoramento.';

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
  -- Idempotência: não cria se já existe SLA aberto
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
      public.sla_horas_from_config(v_config, v_prior),
      24
    );
  END IF;

  v_inicio := now();

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
    v_prior,
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
  'Cria sla_operacional no INSERT de levantamento_item apenas se prioridade estiver em P1/P2/P3 '
  '(ou rótulos legados equivalentes). Usa sla_calcular_prazo_final; fallback now()+interval se ausente.';
