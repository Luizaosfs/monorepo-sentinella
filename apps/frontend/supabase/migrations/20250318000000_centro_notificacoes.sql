-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Centro de Notificações de Casos
-- Tabelas: unidades_saude, casos_notificados, caso_foco_cruzamento
-- Trigger de cruzamento geoespacial + RPC listar_casos_no_raio
-- ─────────────────────────────────────────────────────────────────────────────

-- ── unidades_saude ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unidades_saude (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  nome        text        NOT NULL,
  tipo        text        NOT NULL DEFAULT 'ubs'
                          CHECK (tipo IN ('ubs','upa','hospital','outro')),
  endereco    text,
  latitude    float8,
  longitude   float8,
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE unidades_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_saude_isolamento" ON unidades_saude
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX ON unidades_saude (cliente_id);

-- ── casos_notificados ─────────────────────────────────────────────────────────
-- LGPD: NÃO armazenar nome, CPF, data de nascimento ou qualquer
--       identificador direto do paciente.
CREATE TABLE IF NOT EXISTS casos_notificados (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid        NOT NULL REFERENCES clientes(id)       ON DELETE CASCADE,
  unidade_saude_id      uuid        NOT NULL REFERENCES unidades_saude(id) ON DELETE RESTRICT,
  notificador_id        uuid        REFERENCES usuarios(id),
  doenca                text        NOT NULL DEFAULT 'suspeito'
                                    CHECK (doenca IN ('dengue','chikungunya','zika','suspeito')),
  status                text        NOT NULL DEFAULT 'suspeito'
                                    CHECK (status IN ('suspeito','confirmado','descartado')),
  data_inicio_sintomas  date,
  data_notificacao      date        NOT NULL DEFAULT CURRENT_DATE,
  endereco_paciente     text,
  bairro                text,
  latitude              float8,
  longitude             float8,
  regiao_id             uuid        REFERENCES regioes(id),
  observacao            text,
  payload               jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE casos_notificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casos_notificados_isolamento" ON casos_notificados
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX ON casos_notificados (cliente_id);
CREATE INDEX ON casos_notificados (unidade_saude_id);
CREATE INDEX ON casos_notificados (regiao_id) WHERE regiao_id IS NOT NULL;
-- Índice para consultas geoespaciais (sem PostGIS extension index, filtro por bbox)
CREATE INDEX ON casos_notificados (cliente_id, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── caso_foco_cruzamento ──────────────────────────────────────────────────────
-- Preenchido exclusivamente pelo trigger fn_cruzar_caso_com_focos.
-- Nunca inserir manualmente.
CREATE TABLE IF NOT EXISTS caso_foco_cruzamento (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id               uuid        NOT NULL REFERENCES casos_notificados(id)  ON DELETE CASCADE,
  levantamento_item_id  uuid        NOT NULL REFERENCES levantamento_itens(id) ON DELETE CASCADE,
  distancia_metros      float8      NOT NULL,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caso_id, levantamento_item_id)
);

ALTER TABLE caso_foco_cruzamento ENABLE ROW LEVEL SECURITY;

-- Acesso via caso_id — o RLS do caso já garante o isolamento por cliente
CREATE POLICY "caso_foco_cruzamento_isolamento" ON caso_foco_cruzamento
  USING (
    caso_id IN (
      SELECT id FROM casos_notificados
      WHERE cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    )
  );

CREATE INDEX ON caso_foco_cruzamento (caso_id);
CREATE INDEX ON caso_foco_cruzamento (levantamento_item_id);

-- ── Trigger de cruzamento geoespacial ────────────────────────────────────────
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

  -- 2. Elevar prioridade dos focos cruzados para Crítico e marcar no payload
  UPDATE levantamento_itens
  SET
    prioridade = 'Crítico',
    payload = jsonb_set(
      COALESCE(payload, '{}'::jsonb),
      '{caso_notificado_proximidade}',
      to_jsonb(NEW.id::text)
    )
  WHERE id IN (
    SELECT levantamento_item_id
    FROM caso_foco_cruzamento
    WHERE caso_id = NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cruzar_caso_focos
  AFTER INSERT ON casos_notificados
  FOR EACH ROW EXECUTE FUNCTION fn_cruzar_caso_com_focos();

-- ── RPC: listar casos num raio a partir de um ponto ──────────────────────────
CREATE OR REPLACE FUNCTION listar_casos_no_raio(
  p_lat     float8,
  p_lng     float8,
  p_raio    int,
  p_cliente uuid
)
RETURNS SETOF casos_notificados AS $$
  SELECT *
  FROM casos_notificados
  WHERE
    cliente_id = p_cliente
    AND status != 'descartado'
    AND latitude  IS NOT NULL
    AND longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(p_lng, p_lat)::geography,
      ST_MakePoint(longitude, latitude)::geography,
      p_raio
    )
  ORDER BY created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── RPC: contar cruzamentos ativos para um levantamento_item ─────────────────
CREATE OR REPLACE FUNCTION contar_casos_proximos_ao_item(p_item_id uuid)
RETURNS int AS $$
  SELECT COUNT(*)::int
  FROM caso_foco_cruzamento
  WHERE levantamento_item_id = p_item_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── updated_at automático ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_unidades_saude_updated_at'
  ) THEN
    CREATE TRIGGER trg_unidades_saude_updated_at
      BEFORE UPDATE ON unidades_saude
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_casos_notificados_updated_at'
  ) THEN
    CREATE TRIGGER trg_casos_notificados_updated_at
      BEFORE UPDATE ON casos_notificados
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END
$$;
