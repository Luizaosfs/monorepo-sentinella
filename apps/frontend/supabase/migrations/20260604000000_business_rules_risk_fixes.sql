-- ─────────────────────────────────────────────────────────────────────────────
-- Business Rules Risk Fixes
-- R-38: caso_notificado_proximidade acumula lista em vez de sobrescrever
-- R-29: CHECK qtd_com_focos <= qtd_inspecionados em vistoria_depositos
-- R-26: Trigger prioridade_drone com janela de 60 dias
-- R-08: Trigger de validação de transição de status_atendimento
-- R-37: Índices GIST para consultas geoespaciais com PostGIS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── R-38: fn_cruzar_caso_com_focos — acumula IDs em array ────────────────────
-- Correção: usar jsonb_set com concatenação de array para não sobrescrever
-- cruzamentos anteriores quando um item está próximo de múltiplos casos.
CREATE OR REPLACE FUNCTION fn_cruzar_caso_com_focos()
RETURNS TRIGGER AS $$
DECLARE
  raio_metros CONSTANT int := 300;
BEGIN
  -- Ignorar casos sem coordenadas
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Inserir cruzamentos com focos pendentes/em atendimento no raio de 300m
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
    AND li.status_atendimento != 'resolvido'
    AND ST_DWithin(
      ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
      ST_MakePoint(li.longitude,  li.latitude)::geography,
      raio_metros
    )
  ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING;

  -- 2. Elevar prioridade e ACUMULAR caso_id no array (não sobrescreve)
  --    payload.casos_notificados_proximidade = [id1, id2, ...]
  UPDATE levantamento_itens
  SET
    prioridade = 'Crítico',
    payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{casos_notificados_proximidade}',
      COALESCE(
        (COALESCE(payload, '{}'::jsonb) -> 'casos_notificados_proximidade'),
        '[]'::jsonb
      ) || to_jsonb(NEW.id::text)
    )
  WHERE id IN (
    SELECT levantamento_item_id
    FROM caso_foco_cruzamento
    WHERE caso_id = NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── R-29: CHECK qtd_com_focos <= qtd_inspecionados ───────────────────────────
ALTER TABLE vistoria_depositos
  DROP CONSTRAINT IF EXISTS chk_focos_lte_inspecionados;

ALTER TABLE vistoria_depositos
  ADD CONSTRAINT chk_focos_lte_inspecionados
  CHECK (qtd_com_focos <= qtd_inspecionados);

-- ── R-26: Trigger prioridade_drone com janela 60 dias ────────────────────────
-- Antes: contava tentativas sem acesso de todos os tempos.
-- Agora: conta apenas os últimos 60 dias para refletir situação atual do imóvel.
CREATE OR REPLACE FUNCTION fn_atualizar_perfil_imovel()
RETURNS TRIGGER AS $$
DECLARE
  v_sem_acesso int;
BEGIN
  IF NEW.acesso_realizado = false THEN
    SELECT COUNT(*) INTO v_sem_acesso
    FROM vistorias
    WHERE imovel_id = NEW.imovel_id
      AND acesso_realizado = false
      AND created_at >= now() - interval '60 days';  -- janela de 60 dias

    IF v_sem_acesso >= 3 THEN
      UPDATE imoveis
      SET historico_recusa = true,
          prioridade_drone  = true
      WHERE id = NEW.imovel_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger (função já substituída acima)
DROP TRIGGER IF EXISTS trg_atualizar_perfil_imovel ON vistorias;
CREATE TRIGGER trg_atualizar_perfil_imovel
  AFTER INSERT OR UPDATE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_perfil_imovel();

-- ── R-08: Validação de transição de status_atendimento ───────────────────────
-- Bloqueia salto direto de "pendente" para "resolvido" (deve passar por
-- "em_atendimento" para garantir rastreabilidade do atendimento).
CREATE OR REPLACE FUNCTION fn_validar_transicao_status_atendimento()
RETURNS TRIGGER AS $$
BEGIN
  -- Só valida quando o status efetivamente muda
  IF OLD.status_atendimento IS DISTINCT FROM NEW.status_atendimento THEN
    IF OLD.status_atendimento = 'pendente' AND NEW.status_atendimento = 'resolvido' THEN
      RAISE EXCEPTION
        'Transição inválida de status_atendimento: "pendente" → "resolvido". '
        'O item deve passar por "em_atendimento" antes de ser resolvido.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_transicao_status_atendimento ON levantamento_itens;
CREATE TRIGGER trg_validar_transicao_status_atendimento
  BEFORE UPDATE ON levantamento_itens
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicao_status_atendimento();

-- ── R-37: Índices GIST para consultas geoespaciais PostGIS ───────────────────
-- Substitui os índices btree em (lat, lng) por índices GIST em geography,
-- que são nativamente suportados pelo ST_DWithin e ST_Distance.
CREATE INDEX IF NOT EXISTS idx_casos_notificados_geo
  ON casos_notificados
  USING GIST ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_levantamento_itens_geo
  ON levantamento_itens
  USING GIST ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON FUNCTION fn_cruzar_caso_com_focos() IS
  'R-38: acumula caso IDs em array casos_notificados_proximidade no payload do item';
COMMENT ON FUNCTION fn_atualizar_perfil_imovel() IS
  'R-26: janela 60 dias para contagem de tentativas sem acesso';
COMMENT ON FUNCTION fn_validar_transicao_status_atendimento() IS
  'R-08: bloqueia transição pendente → resolvido sem passar por em_atendimento';
