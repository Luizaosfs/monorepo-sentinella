-- =============================================================================
-- 1B: Corrigir fn_cruzar_caso_com_focos
--
-- Problema: filtro AND li.status_atendimento != 'resolvido' referencia coluna
-- removida em 20260711000000. O cruzamento epidemiológico caso↔foco está falhando.
--
-- Fix: substituir pelo filtro via focos_risco.status.
-- Adicionado: UPDATE de focos_risco.casos_ids e prioridade (entidade operacional).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_cruzar_caso_com_focos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raio_metros CONSTANT int := 300;
BEGIN
  -- Ignorar casos sem coordenadas
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Inserir cruzamentos com focos não-terminais no raio de 300m
  INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    NEW.id,
    li.id,
    ST_Distance(
      ST_MakePoint(NEW.longitude,  NEW.latitude)::geography,
      ST_MakePoint(li.longitude,   li.latitude)::geography
    )
  FROM levantamento_itens li
  JOIN levantamentos l ON l.id = li.levantamento_id
  WHERE
    l.cliente_id = NEW.cliente_id
    AND li.latitude  IS NOT NULL
    AND li.longitude IS NOT NULL
    -- FIX: usar focos_risco.status em vez de levantamento_itens.status_atendimento (removida)
    AND NOT EXISTS (
      SELECT 1 FROM focos_risco fr
      WHERE fr.origem_levantamento_item_id = li.id
        AND fr.status IN ('resolvido', 'descartado')
    )
    AND ST_DWithin(
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      ST_MakePoint(li.longitude,  li.latitude)::geography,
      raio_metros
    )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- 2. Atualizar focos_risco: casos_ids e prioridade (entidade operacional central)
  UPDATE focos_risco
  SET
    casos_ids  = array_append(array_remove(casos_ids, NEW.id), NEW.id),
    prioridade = 'P1',
    updated_at = now()
  WHERE origem_levantamento_item_id IN (
    SELECT levantamento_item_id FROM caso_foco_cruzamento WHERE caso_id = NEW.id
  )
  AND status NOT IN ('resolvido', 'descartado');

  -- 3. Compatibilidade: atualizar levantamento_itens.prioridade e payload
  UPDATE levantamento_itens
  SET
    prioridade = 'Crítico',
    payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{caso_notificado_proximidade}',
      to_jsonb(NEW.id::text)
    )
  WHERE id IN (
    SELECT levantamento_item_id FROM caso_foco_cruzamento WHERE caso_id = NEW.id
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_cruzar_caso_com_focos() IS
  'Trigger AFTER INSERT em casos_notificados: cruzamento geoespacial 300m com '
  'levantamento_itens e focos_risco. Eleva prioridade para Crítico/P1 nos focos próximos. '
  'Fix 1B: filtro via focos_risco.status (removida coluna status_atendimento em 20260711).';
