-- ─────────────────────────────────────────────────────────────────────────────
-- D-02: Reverter prioridade de levantamento_item quando caso é descartado
-- D-03: Trigger inverso — novo foco busca casos existentes próximos
-- E-02: Marcar falso positivo (yolo_feedback.confirmado=false) fecha SLA
-- ─────────────────────────────────────────────────────────────────────────────

-- ── D-02: fn_reverter_prioridade_caso_descartado ─────────────────────────────
-- Quando um caso é atualizado para 'descartado', reverte a prioridade dos itens
-- cruzados que não têm outros casos ativos (não descartados) associados.
-- Usa campo prioridade_original se preenchido, senão 'Média'.
CREATE OR REPLACE FUNCTION fn_reverter_prioridade_caso_descartado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'descartado' AND OLD.status IS DISTINCT FROM 'descartado' THEN
    UPDATE levantamento_itens li
    SET prioridade = COALESCE(li.prioridade_original, 'Média')
    FROM caso_foco_cruzamento cfc
    WHERE cfc.caso_id    = OLD.id
      AND cfc.levantamento_item_id = li.id
      -- Só reverte se não há outros casos ativos cruzados com este item
      AND NOT EXISTS (
        SELECT 1
        FROM caso_foco_cruzamento cfc2
        JOIN casos_notificados cn ON cn.id = cfc2.caso_id
        WHERE cfc2.levantamento_item_id = li.id
          AND cn.status != 'descartado'
          AND cn.id      != OLD.id
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reverter_prioridade_caso_descartado ON casos_notificados;
CREATE TRIGGER trg_reverter_prioridade_caso_descartado
  AFTER UPDATE ON casos_notificados
  FOR EACH ROW
  WHEN (NEW.status = 'descartado' AND OLD.status IS DISTINCT FROM 'descartado')
  EXECUTE FUNCTION fn_reverter_prioridade_caso_descartado();

-- ── D-03: Trigger inverso — novo levantamento_item busca casos próximos ──────
-- Complementa fn_cruzar_caso_com_focos: quando um novo foco é identificado,
-- cruza com casos_notificados não-descartados já existentes no raio de 300m.
CREATE OR REPLACE FUNCTION fn_cruzar_foco_com_casos()
RETURNS TRIGGER AS $$
DECLARE
  raio_metros CONSTANT int := 300;
  v_cliente_id uuid;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve cliente_id via levantamento
  SELECT l.cliente_id INTO v_cliente_id
  FROM levantamentos l
  WHERE l.id = NEW.levantamento_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insere cruzamentos com casos ativos próximos
  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    cn.id,
    NEW.id,
    ST_Distance(
      ST_MakePoint(cn.longitude,  cn.latitude)::geography,
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography
    )
  FROM casos_notificados cn
  WHERE
    cn.cliente_id = v_cliente_id
    AND cn.status  != 'descartado'
    AND cn.latitude  IS NOT NULL
    AND cn.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(cn.longitude, cn.latitude)::geography,
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      raio_metros
    )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- Eleva prioridade se houver cruzamentos novos
  IF EXISTS (
    SELECT 1 FROM caso_foco_cruzamento
    WHERE levantamento_item_id = NEW.id
  ) THEN
    UPDATE levantamento_itens
    SET
      prioridade = 'Crítico',
      payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{casos_notificados_proximidade}',
        COALESCE(
          (COALESCE(payload, '{}'::jsonb) -> 'casos_notificados_proximidade'),
          '[]'::jsonb
        ) || (
          SELECT jsonb_agg(to_jsonb(cfc.caso_id::text))
          FROM caso_foco_cruzamento cfc
          WHERE cfc.levantamento_item_id = NEW.id
        )
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cruzar_foco_com_casos ON levantamento_itens;
CREATE TRIGGER trg_cruzar_foco_com_casos
  AFTER INSERT ON levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION fn_cruzar_foco_com_casos();

-- ── E-02: Falso positivo fecha SLA associado ──────────────────────────────────
-- Quando yolo_feedback.confirmado é setado para false, fecha o sla_operacional
-- aberto para aquele levantamento_item_id.
CREATE OR REPLACE FUNCTION fn_falso_positivo_fecha_sla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confirmado = false AND (OLD.confirmado IS NULL OR OLD.confirmado = true) THEN
    UPDATE sla_operacional
    SET
      status      = 'concluido',
      concluido_em = now()
    WHERE levantamento_item_id = NEW.levantamento_item_id
      AND status NOT IN ('concluido', 'vencido');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_falso_positivo_fecha_sla ON yolo_feedback;
CREATE TRIGGER trg_falso_positivo_fecha_sla
  AFTER INSERT OR UPDATE ON yolo_feedback
  FOR EACH ROW EXECUTE FUNCTION fn_falso_positivo_fecha_sla();

COMMENT ON FUNCTION fn_reverter_prioridade_caso_descartado() IS
  'D-02: reverte prioridade de levantamento_item para prioridade_original quando '
  'o caso notificado associado é descartado e não há outros casos ativos no raio';
COMMENT ON FUNCTION fn_cruzar_foco_com_casos() IS
  'D-03: trigger inverso — ao inserir levantamento_item, busca casos_notificados '
  'existentes no raio de 300m e cria cruzamentos retroativos';
COMMENT ON FUNCTION fn_falso_positivo_fecha_sla() IS
  'E-02: ao marcar yolo_feedback.confirmado=false, fecha sla_operacional aberto '
  'do item para evitar alertas de SLA para falsos positivos';
