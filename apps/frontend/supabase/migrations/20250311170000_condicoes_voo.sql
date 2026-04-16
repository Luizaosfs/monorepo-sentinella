-- =============================================================================
-- Condições para voo de drone baseadas em dados pluviométricos
--
-- Função: avaliar_condicoes_voo(cliente_id, data?)
--   Verifica pluvio_risco das regiões do cliente e retorna se as condições
--   meteorológicas são adequadas para realizar um voo de drone.
--
-- Critérios de impedimento:
--   - Risco pluviométrico laranja ou vermelho
--   - Vento > 30 km/h
--   - Chuva recente > 10 mm nas últimas 24h
--   - Previsão de chuva > 5 mm para o dia
-- =============================================================================

CREATE OR REPLACE FUNCTION avaliar_condicoes_voo(
  p_cliente_id uuid,
  p_data       date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          record;
  v_apto         boolean := true;
  v_motivos      text[]  := '{}';
  v_nivel        text    := 'verde';
  v_vento        float   := null;
  v_chuva_24h    float   := null;
  v_prev_d1      float   := null;
  v_temp         float   := null;
  v_dt_ref       text    := null;

  -- Thresholds
  VENTO_LIMITE  constant float := 30.0;  -- km/h
  CHUVA_LIMITE  constant float := 10.0;  -- mm/24h
  PREV_LIMITE   constant float := 5.0;   -- mm forecast d+1
BEGIN
  -- Get worst-case pluvio_risco entry for the client on or near p_data
  -- (highest risk level wins, then most recent)
  SELECT
    pr.classificacao_final,
    pr.vento_kmh,
    pr.chuva_24h,
    pr.prev_d1_mm,
    pr.temp_c,
    pr.dt_ref::text
  INTO v_row
  FROM pluvio_risco pr
  JOIN regioes r ON r.id = pr.regiao_id
  WHERE r.cliente_id = p_cliente_id
    AND pr.dt_ref::date >= p_data - 1
  ORDER BY
    CASE pr.classificacao_final
      WHEN 'vermelho' THEN 4
      WHEN 'laranja'  THEN 3
      WHEN 'amarelo'  THEN 2
      ELSE 1
    END DESC,
    pr.updated_at DESC
  LIMIT 1;

  -- No pluvio data available — return unknown, apto=true (no grounds to block)
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'apto',         true,
      'nivel_risco',  null,
      'motivos',      '[]'::jsonb,
      'vento_kmh',    null,
      'chuva_24h_mm', null,
      'prev_d1_mm',   null,
      'temp_c',       null,
      'dt_ref',       null
    );
  END IF;

  v_vento     := v_row.vento_kmh;
  v_chuva_24h := v_row.chuva_24h;
  v_prev_d1   := v_row.prev_d1_mm;
  v_temp      := v_row.temp_c;
  v_dt_ref    := v_row.dt_ref;
  v_nivel     := COALESCE(v_row.classificacao_final, 'verde');

  -- ── Evaluate each criterion ──────────────────────────────────────────────

  IF v_nivel IN ('vermelho', 'laranja') THEN
    v_apto    := false;
    v_motivos := array_append(v_motivos,
      'Risco pluviométrico ' || upper(substring(v_nivel, 1, 1)) || substring(v_nivel, 2)
      || ': condições desfavoráveis para operação de drone'
    );
  END IF;

  IF v_vento IS NOT NULL AND v_vento > VENTO_LIMITE THEN
    v_apto    := false;
    v_motivos := array_append(v_motivos,
      format('Vento elevado: %.0f km/h (limite seguro: %s km/h)', v_vento, VENTO_LIMITE)
    );
  END IF;

  IF v_chuva_24h IS NOT NULL AND v_chuva_24h > CHUVA_LIMITE THEN
    v_apto    := false;
    v_motivos := array_append(v_motivos,
      format('Chuva recente: %.1f mm nas últimas 24h', v_chuva_24h)
    );
  END IF;

  IF v_prev_d1 IS NOT NULL AND v_prev_d1 > PREV_LIMITE THEN
    v_apto    := false;
    v_motivos := array_append(v_motivos,
      format('Previsão de chuva: %.1f mm para hoje', v_prev_d1)
    );
  END IF;

  RETURN jsonb_build_object(
    'apto',         v_apto,
    'nivel_risco',  v_nivel,
    'motivos',      to_jsonb(v_motivos),
    'vento_kmh',    v_vento,
    'chuva_24h_mm', v_chuva_24h,
    'prev_d1_mm',   v_prev_d1,
    'temp_c',       v_temp,
    'dt_ref',       v_dt_ref
  );
END;
$$;

COMMENT ON FUNCTION avaliar_condicoes_voo(uuid, date) IS
  'Avalia condições meteorológicas para voo de drone com base no pluvio_risco do cliente. '
  'Retorna { apto, nivel_risco, motivos[], vento_kmh, chuva_24h_mm, prev_d1_mm, temp_c, dt_ref }. '
  'Critérios: risco laranja/vermelho, vento > 30 km/h, chuva 24h > 10 mm, previsão > 5 mm.';

GRANT EXECUTE ON FUNCTION avaliar_condicoes_voo(uuid, date) TO authenticated;
