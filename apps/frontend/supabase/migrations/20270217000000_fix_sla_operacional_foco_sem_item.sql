-- Corrige definitivamente o erro "sla_operacional_item_exclusivo" para focos
-- sem levantamento_item de origem (denúncias cidadão, vistoria direta, etc).
--
-- PROBLEMA:
--   A constraint exige num_nonnulls(item_id, levantamento_item_id) = 1, mas
--   focos criados sem origem_levantamento_item_id não têm como preencher nenhum
--   dos dois campos. A função retornava sem criar SLA (fix anterior), mas o
--   erro persistia porque o foco DEVERIA ter SLA — o CLAUDE.md confirma isso.
--
-- FIX:
--   1. Substituir a constraint por uma que aceita foco_risco_id como âncora
--      alternativa quando não há item nem levantamento_item.
--   2. Atualizar fn_iniciar_sla_ao_confirmar_foco para criar SLA com
--      foco_risco_id como única âncora quando origem_levantamento_item_id IS NULL.

-- ── 1. Constraint ──────────────────────────────────────────────────────────────

ALTER TABLE public.sla_operacional
  DROP CONSTRAINT IF EXISTS sla_operacional_item_exclusivo;

ALTER TABLE public.sla_operacional
  ADD CONSTRAINT sla_operacional_item_exclusivo CHECK (
    num_nonnulls(item_id, levantamento_item_id) = 1
    OR (
      item_id              IS NULL
      AND levantamento_item_id IS NULL
      AND foco_risco_id    IS NOT NULL
    )
  );

-- ── 2. fn_iniciar_sla_ao_confirmar_foco — versão final ─────────────────────────

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

  -- 3. Cria SLA usando a config do cliente/região via sla_resolve_config()
  --    Funciona tanto para focos com levantamento_item quanto para focos diretos
  --    (denúncia cidadão, vistoria, etc.) — neste caso levantamento_item_id = NULL
  --    e foco_risco_id serve como âncora (permitido pela constraint atualizada).
  v_prioridade := COALESCE(NEW.prioridade, 'P3');
  v_config     := sla_resolve_config(NEW.cliente_id, NEW.regiao_id);

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
    NEW.origem_levantamento_item_id,  -- pode ser NULL para focos diretos
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
