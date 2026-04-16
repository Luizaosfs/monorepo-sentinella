-- ─────────────────────────────────────────────────────────────────────────────
-- AUX-2 — Integração epidemiológica bidirecional focos_risco ↔ casos_notificados
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Nova coluna em focos_risco ─────────────────────────────────────────────

ALTER TABLE focos_risco
  ADD COLUMN IF NOT EXISTS prioridade_original_antes_caso text
    CHECK (prioridade_original_antes_caso IN ('P1','P2','P3','P4','P5'));

COMMENT ON COLUMN focos_risco.prioridade_original_antes_caso IS
  'Prioridade antes de ser elevada para P1 pela proximidade de caso notificado. '
  'Usada por fn_reverter_prioridade_caso_descartado para restaurar o valor original.';

-- ── 2. Trigger: foco novo → cruza com casos próximos ─────────────────────────

CREATE OR REPLACE FUNCTION fn_cruzar_foco_novo_com_casos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raio_metros CONSTANT int := 300;
  v_casos_ids  uuid[];
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Inserir cruzamentos com casos não descartados no raio
  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    cn.id,
    NEW.origem_levantamento_item_id,
    ST_Distance(
      geography(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)),
      geography(ST_SetSRID(ST_MakePoint(cn.longitude,  cn.latitude),  4326))
    )
  FROM casos_notificados cn
  WHERE cn.cliente_id = NEW.cliente_id
    AND cn.status    != 'descartado'
    AND cn.latitude  IS NOT NULL
    AND cn.longitude IS NOT NULL
    AND ST_DWithin(
          geography(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)),
          geography(ST_SetSRID(ST_MakePoint(cn.longitude,  cn.latitude),  4326)),
          raio_metros
        )
    AND NEW.origem_levantamento_item_id IS NOT NULL
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- Coletar IDs dos casos próximos (direto via geo, sem depender do INSERT acima)
  SELECT array_agg(cn.id) INTO v_casos_ids
    FROM casos_notificados cn
   WHERE cn.cliente_id = NEW.cliente_id
     AND cn.status    != 'descartado'
     AND cn.latitude  IS NOT NULL
     AND cn.longitude IS NOT NULL
     AND ST_DWithin(
           geography(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)),
           geography(ST_SetSRID(ST_MakePoint(cn.longitude,  cn.latitude),  4326)),
           raio_metros
         );

  IF v_casos_ids IS NOT NULL AND array_length(v_casos_ids, 1) > 0 THEN
    -- Atualizar casos_ids e elevar prioridade para P1 (preservando original)
    UPDATE focos_risco
       SET casos_ids                     = v_casos_ids,
           prioridade_original_antes_caso = CASE
             WHEN prioridade IS DISTINCT FROM 'P1' THEN prioridade
             ELSE prioridade_original_antes_caso
           END,
           prioridade                    = 'P1'
     WHERE id = NEW.id
       AND prioridade IS DISTINCT FROM 'P1';

    -- Se já era P1, apenas atualiza casos_ids
    UPDATE focos_risco
       SET casos_ids = v_casos_ids
     WHERE id = NEW.id
       AND prioridade = 'P1'
       AND casos_ids IS DISTINCT FROM v_casos_ids;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cruzar_foco_novo_com_casos
  AFTER INSERT ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_cruzar_foco_novo_com_casos();

-- ── 3. Atualizar fn_cruzar_caso_com_focos ────────────────────────────────────
-- Substitui a atualização de payload.casos_notificados_proximidade
-- pela atualização direta de focos_risco.casos_ids.

CREATE OR REPLACE FUNCTION fn_cruzar_caso_com_focos()
RETURNS TRIGGER AS $$
DECLARE
  raio_metros CONSTANT int := 300;
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Inserir cruzamentos com focos ativos no raio de 300m
  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    NEW.id,
    li.id,
    ST_Distance(
      geography(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)),
      geography(ST_SetSRID(ST_MakePoint(li.longitude,  li.latitude),  4326))
    )
  FROM levantamento_itens li
  JOIN levantamentos l ON l.id = li.levantamento_id
  WHERE
    l.cliente_id = NEW.cliente_id
    AND li.latitude  IS NOT NULL
    AND li.longitude IS NOT NULL
    AND li.status_atendimento != 'resolvido'
    AND ST_DWithin(
          geography(ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)),
          geography(ST_SetSRID(ST_MakePoint(li.longitude,  li.latitude),  4326)),
          raio_metros
        )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- 2. Elevar prioridade dos levantamento_itens cruzados (comportamento legado)
  PERFORM set_config('sentinella.trigger_interno', 'true', true);
  UPDATE levantamento_itens
     SET prioridade = 'Crítico'
   WHERE id IN (
     SELECT levantamento_item_id
       FROM caso_foco_cruzamento
      WHERE caso_id = NEW.id
   )
     AND prioridade IS DISTINCT FROM 'Crítico';
  PERFORM set_config('sentinella.trigger_interno', 'false', true);

  -- 3. Atualizar focos_risco.casos_ids (substitui payload.casos_notificados_proximidade)
  UPDATE focos_risco fr
     SET casos_ids = array_append(
           array_remove(fr.casos_ids, NEW.id),
           NEW.id
         ),
         prioridade_original_antes_caso = CASE
           WHEN fr.prioridade IS DISTINCT FROM 'P1' THEN fr.prioridade
           ELSE fr.prioridade_original_antes_caso
         END,
         prioridade = 'P1'
   WHERE fr.origem_levantamento_item_id IN (
     SELECT levantamento_item_id
       FROM caso_foco_cruzamento
      WHERE caso_id = NEW.id
   )
     AND fr.status NOT IN ('resolvido', 'descartado');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 4. Atualizar fn_reverter_prioridade_caso_descartado ───────────────────────
-- Usa prioridade_original_antes_caso em vez de payload.prioridade_original.
-- Trigger existente no projeto — apenas redefine a função.

CREATE OR REPLACE FUNCTION fn_reverter_prioridade_caso_descartado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'descartado' AND OLD.status != 'descartado' THEN
    -- Reverter prioridade dos focos elevados por este caso
    UPDATE focos_risco fr
       SET prioridade                    = COALESCE(fr.prioridade_original_antes_caso, fr.prioridade),
           prioridade_original_antes_caso = NULL,
           casos_ids                     = array_remove(fr.casos_ids, OLD.id)
     WHERE OLD.id = ANY(fr.casos_ids)
       AND fr.status NOT IN ('resolvido', 'descartado');
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger se existir (garante que usa a função atualizada)
DROP TRIGGER IF EXISTS trg_reverter_prioridade_caso_descartado ON casos_notificados;
CREATE TRIGGER trg_reverter_prioridade_caso_descartado
  AFTER UPDATE ON casos_notificados
  FOR EACH ROW
  WHEN (NEW.status = 'descartado' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_reverter_prioridade_caso_descartado();

-- ── 5. View v_focos_com_casos ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_focos_com_casos
WITH (security_invoker = true)
AS
SELECT
  fr.id                   AS foco_id,
  fr.cliente_id,
  fr.status               AS foco_status,
  fr.prioridade           AS foco_prioridade,
  fr.latitude             AS foco_lat,
  fr.longitude            AS foco_lng,
  fr.endereco_normalizado,
  fr.suspeita_em,
  fr.confirmado_em,
  cn.id                   AS caso_id,
  cn.status               AS caso_status,
  cn.doenca               AS caso_doenca,
  cn.data_notificacao,
  cn.bairro               AS caso_bairro,
  cfc.distancia_metros
FROM focos_risco fr
JOIN unnest(fr.casos_ids) AS cid(caso_uuid) ON true
JOIN casos_notificados cn  ON cn.id = cid.caso_uuid
LEFT JOIN caso_foco_cruzamento cfc
       ON cfc.caso_id              = cn.id
      AND cfc.levantamento_item_id = fr.origem_levantamento_item_id
WHERE array_length(fr.casos_ids, 1) > 0;

COMMENT ON VIEW v_focos_com_casos IS
  'Focos com pelo menos um caso notificado próximo (casos_ids não vazio). '
  'Expande o array casos_ids via unnest e faz JOIN em casos_notificados. '
  'security_invoker = true — RLS aplicada automaticamente.';
