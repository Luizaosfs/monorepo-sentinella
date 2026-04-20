-- Corrige violação de "sla_operacional_item_exclusivo" em fn_iniciar_sla_ao_confirmar_foco.
--
-- Causa: a constraint CHECK(num_nonnulls(item_id, levantamento_item_id) = 1) exige
-- exatamente um dos dois não-nulo. Quando o foco não tem origem_levantamento_item_id
-- (focos manuais, denúncias cidadão, etc.), o INSERT passava levantamento_item_id=NULL
-- e item_id não setado (NULL) → num_nonnulls = 0 → constraint violation.
--
-- Fix: se não há origem_levantamento_item_id, não cria SLA via este trigger.
-- O SLA para focos sem item de origem deve ser criado por outro fluxo se necessário.

CREATE OR REPLACE FUNCTION fn_iniciar_sla_ao_confirmar_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla_existente_id  uuid;
  v_config            jsonb;
  v_prioridade        text;
  v_sla_horas         float8;
  v_prazo_final       timestamptz;
BEGIN
  -- 1. Se já existe SLA vinculado ao foco, não faz nada
  SELECT id INTO v_sla_existente_id
    FROM sla_operacional
   WHERE foco_risco_id = NEW.id
   LIMIT 1;

  IF v_sla_existente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Se existe SLA vinculado ao levantamento_item de origem, apenas vincula
  IF NEW.origem_levantamento_item_id IS NOT NULL THEN
    UPDATE sla_operacional
       SET foco_risco_id = NEW.id
     WHERE levantamento_item_id = NEW.origem_levantamento_item_id
       AND foco_risco_id IS NULL;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  -- 3. Sem item de origem: não é possível criar SLA (constraint exige item_id
  --    ou levantamento_item_id não-nulo). Foco manual/denúncia sem levantamento_item.
  IF NEW.origem_levantamento_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Cria novo SLA usando a config do cliente/região via sla_resolve_config()
  v_prioridade := COALESCE(NEW.prioridade, 'P3');
  v_config := sla_resolve_config(NEW.cliente_id, NEW.regiao_id);

  v_sla_horas := CASE v_prioridade
    WHEN 'P1' THEN COALESCE((v_config->>'p1_horas')::float8, 4)
    WHEN 'P2' THEN COALESCE((v_config->>'p2_horas')::float8, 12)
    WHEN 'P3' THEN COALESCE((v_config->>'p3_horas')::float8, 24)
    WHEN 'P4' THEN COALESCE((v_config->>'p4_horas')::float8, 72)
    WHEN 'P5' THEN COALESCE((v_config->>'p5_horas')::float8, 168)
    ELSE 24
  END;

  v_prazo_final := COALESCE(NEW.confirmado_em, now()) + (v_sla_horas || ' hours')::interval;

  INSERT INTO sla_operacional (
    cliente_id,
    levantamento_item_id,
    foco_risco_id,
    prioridade,
    status,
    inicio,
    prazo_final,
    sla_horas
  ) VALUES (
    NEW.cliente_id,
    NEW.origem_levantamento_item_id,
    NEW.id,
    v_prioridade,
    'aberto',
    COALESCE(NEW.confirmado_em, now()),
    v_prazo_final,
    v_sla_horas
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
