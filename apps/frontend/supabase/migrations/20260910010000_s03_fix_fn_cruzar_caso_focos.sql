-- =============================================================================
-- S03: Reescrever fn_cruzar_caso_com_focos (versão melhorada)
--
-- Melhoria sobre 20260800010000: usa focos_risco diretamente para cruzamento
-- em vez de levantamento_itens. Atualiza prioridade P1 nos focos cruzados
-- e registra caso_id no array casos_ids.
--
-- Mantém: ON CONFLICT DO NOTHING (unique constraint em caso_foco_cruzamento)
-- Mantém: prioridade_original_antes_caso para permitir downgrade futuro
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_cruzar_caso_com_focos()
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

  -- 1. Inserir cruzamentos com focos_risco ATIVOS no raio de 300m
  --    Apenas focos com origem em levantamento_item (para manter a FK NOT NULL)
  INSERT INTO public.caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
  SELECT
    NEW.id,
    fr.origem_levantamento_item_id,
    ST_Distance(
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      ST_MakePoint(fr.longitude,  fr.latitude)::geography
    )
  FROM public.focos_risco fr
  WHERE
    fr.cliente_id = NEW.cliente_id
    AND fr.latitude  IS NOT NULL
    AND fr.longitude IS NOT NULL
    AND fr.origem_levantamento_item_id IS NOT NULL
    AND fr.status NOT IN ('resolvido', 'descartado')
    AND fr.deleted_at IS NULL
    AND ST_DWithin(
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      ST_MakePoint(fr.longitude,  fr.latitude)::geography,
      raio_metros
    )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- 2. Elevar prioridade para P1 em TODOS os focos ativos no raio
  --    (inclui focos sem origem em levantamento_item)
  UPDATE public.focos_risco
  SET
    prioridade_original_antes_caso = COALESCE(prioridade_original_antes_caso, prioridade),
    prioridade = 'P1',
    casos_ids  = CASE
      WHEN NEW.id = ANY(COALESCE(casos_ids, ARRAY[]::uuid[]))
        THEN casos_ids
      ELSE array_append(COALESCE(casos_ids, ARRAY[]::uuid[]), NEW.id)
    END,
    updated_at = now()
  WHERE
    cliente_id = NEW.cliente_id
    AND latitude  IS NOT NULL
    AND longitude IS NOT NULL
    AND status NOT IN ('resolvido', 'descartado')
    AND deleted_at IS NULL
    AND prioridade <> 'P1'   -- não faz downgrade se já for P1
    AND ST_DWithin(
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      ST_MakePoint(longitude,     latitude)::geography,
      raio_metros
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_cruzar_caso_com_focos() IS
  'S03: Cruza caso notificado com focos_risco ativos em raio de 300m. '
  'Eleva prioridade para P1, registra caso_id no array casos_ids. '
  'Melhoria 20260910010000: usa focos_risco diretamente (sem levantamento_itens).';
