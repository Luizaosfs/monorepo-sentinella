-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Módulo de Vistoria de Campo (perfil Agente / e-VISITA PNCD)
-- Tabelas: imoveis, vistorias, vistoria_depositos, vistoria_sintomas, vistoria_riscos
-- ─────────────────────────────────────────────────────────────────────────────

-- ── imoveis ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imoveis (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  regiao_id     uuid        REFERENCES regioes(id),
  tipo_imovel   text        NOT NULL DEFAULT 'residencial'
                            CHECK (tipo_imovel IN ('residencial','comercial','terreno','ponto_estrategico')),
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  quarteirao    text,
  latitude      float8,
  longitude     float8,
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imoveis_isolamento" ON imoveis
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX ON imoveis (cliente_id);
CREATE INDEX ON imoveis (regiao_id) WHERE regiao_id IS NOT NULL;
CREATE INDEX ON imoveis (cliente_id, bairro) WHERE bairro IS NOT NULL;

-- ── vistorias ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistorias (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid        NOT NULL REFERENCES clientes(id)      ON DELETE CASCADE,
  imovel_id         uuid        NOT NULL REFERENCES imoveis(id)        ON DELETE RESTRICT,
  agente_id         uuid        NOT NULL REFERENCES usuarios(id),
  planejamento_id   uuid,       -- FK para planejamentos (sem constraint — tabela pode não existir)
  ciclo             int         NOT NULL DEFAULT 1
                                CHECK (ciclo BETWEEN 1 AND 6),
  tipo_atividade    text        NOT NULL DEFAULT 'pesquisa'
                                CHECK (tipo_atividade IN ('tratamento','pesquisa','liraa','ponto_estrategico')),
  data_visita       timestamptz NOT NULL DEFAULT now(),
  status            text        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','visitado','fechado','revisita')),
  moradores_qtd     int,
  gravidas          boolean     NOT NULL DEFAULT false,
  idosos            boolean     NOT NULL DEFAULT false,
  criancas_7anos    boolean     NOT NULL DEFAULT false,
  lat_chegada       float8,
  lng_chegada       float8,
  checkin_em        timestamptz,
  observacao        text,
  payload           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vistorias_isolamento" ON vistorias
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX ON vistorias (cliente_id);
CREATE INDEX ON vistorias (imovel_id);
CREATE INDEX ON vistorias (agente_id);
CREATE INDEX ON vistorias (cliente_id, ciclo);

-- ── vistoria_depositos ────────────────────────────────────────────────────────
-- Padrão PNCD: um registro por tipo de depósito por vistoria.
CREATE TABLE IF NOT EXISTS vistoria_depositos (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id         uuid    NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  tipo                text    NOT NULL
                              CHECK (tipo IN ('A1','A2','B','C','D1','D2','E')),
  qtd_inspecionados   int     NOT NULL DEFAULT 0,
  qtd_com_focos       int     NOT NULL DEFAULT 0,
  qtd_eliminados      int     NOT NULL DEFAULT 0,
  usou_larvicida      boolean NOT NULL DEFAULT false,
  qtd_larvicida_g     float8,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vistoria_id, tipo)
);

ALTER TABLE vistoria_depositos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vistoria_depositos_isolamento" ON vistoria_depositos
  USING (
    vistoria_id IN (
      SELECT id FROM vistorias
      WHERE cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    )
  );

CREATE INDEX ON vistoria_depositos (vistoria_id);

-- ── vistoria_sintomas ─────────────────────────────────────────────────────────
-- LGPD: registra apenas contagem e sintomas — sem identificação de moradores.
CREATE TABLE IF NOT EXISTS vistoria_sintomas (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id               uuid    NOT NULL REFERENCES vistorias(id)          ON DELETE CASCADE,
  cliente_id                uuid    NOT NULL REFERENCES clientes(id)            ON DELETE CASCADE,
  febre                     boolean NOT NULL DEFAULT false,
  manchas_vermelhas         boolean NOT NULL DEFAULT false,
  dor_articulacoes          boolean NOT NULL DEFAULT false,
  dor_cabeca                boolean NOT NULL DEFAULT false,
  moradores_sintomas_qtd    int     NOT NULL DEFAULT 0,
  gerou_caso_notificado_id  uuid,   -- preenchido pelo trigger fn_sintomas_para_caso
  created_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vistoria_sintomas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vistoria_sintomas_isolamento" ON vistoria_sintomas
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

CREATE INDEX ON vistoria_sintomas (vistoria_id);
CREATE INDEX ON vistoria_sintomas (cliente_id);

-- ── vistoria_riscos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vistoria_riscos (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id                 uuid    NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  -- Risco Social (encaminhamento: SEDHAST/SAS)
  menor_incapaz               boolean NOT NULL DEFAULT false,
  idoso_incapaz               boolean NOT NULL DEFAULT false,
  dep_quimico                 boolean NOT NULL DEFAULT false,
  risco_alimentar             boolean NOT NULL DEFAULT false,
  risco_moradia               boolean NOT NULL DEFAULT false,
  -- Risco Sanitário (encaminhamento: VISA Est./Mun.)
  criadouro_animais           boolean NOT NULL DEFAULT false,
  lixo                        boolean NOT NULL DEFAULT false,
  residuos_organicos          boolean NOT NULL DEFAULT false,
  residuos_quimicos           boolean NOT NULL DEFAULT false,
  residuos_medicos            boolean NOT NULL DEFAULT false,
  -- Risco Vetorial (encaminhamento: SES/SMS)
  acumulo_material_organico   boolean NOT NULL DEFAULT false,
  animais_sinais_lv           boolean NOT NULL DEFAULT false,
  caixa_destampada            boolean NOT NULL DEFAULT false,
  outro_risco_vetorial        text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vistoria_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vistoria_riscos_isolamento" ON vistoria_riscos
  USING (
    vistoria_id IN (
      SELECT id FROM vistorias
      WHERE cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    )
  );

CREATE INDEX ON vistoria_riscos (vistoria_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_imoveis_updated_at') THEN
    CREATE TRIGGER trg_imoveis_updated_at
      BEFORE UPDATE ON imoveis
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vistorias_updated_at') THEN
    CREATE TRIGGER trg_vistorias_updated_at
      BEFORE UPDATE ON vistorias
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END
$$;

-- ── Trigger: sintomas → caso notificado ──────────────────────────────────────
-- Cria automaticamente um caso suspeito em casos_notificados quando
-- o agente registra moradores com sintomas.
-- Só executa se a tabela casos_notificados existir (integração opcional).
CREATE OR REPLACE FUNCTION fn_sintomas_para_caso()
RETURNS TRIGGER AS $$
DECLARE
  v_imovel  imoveis%ROWTYPE;
  v_caso_id uuid;
BEGIN
  IF NEW.moradores_sintomas_qtd > 0 THEN
    -- Verificar se casos_notificados existe antes de inserir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'casos_notificados'
    ) THEN
      RETURN NEW;
    END IF;

    -- Buscar dados do imóvel via vistoria
    SELECT im.* INTO v_imovel
    FROM imoveis im
    JOIN vistorias v ON v.imovel_id = im.id
    WHERE v.id = NEW.vistoria_id;

    -- Inserir caso suspeito (sem dados pessoais identificáveis — LGPD)
    INSERT INTO casos_notificados (
      cliente_id, notificador_id, doenca, status,
      data_notificacao, endereco_paciente, bairro,
      latitude, longitude, observacao
    )
    SELECT
      NEW.cliente_id,
      v.agente_id,
      'suspeito',
      'suspeito',
      CURRENT_DATE,
      COALESCE(v_imovel.logradouro || CASE WHEN v_imovel.numero IS NOT NULL THEN ' ' || v_imovel.numero ELSE '' END, ''),
      v_imovel.bairro,
      v_imovel.latitude,
      v_imovel.longitude,
      'Gerado automaticamente por vistoria de campo'
    FROM vistorias v
    WHERE v.id = NEW.vistoria_id
    RETURNING id INTO v_caso_id;

    -- Vincular o caso gerado ao registro de sintomas
    UPDATE vistoria_sintomas
    SET gerou_caso_notificado_id = v_caso_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sintomas_para_caso
  AFTER INSERT ON vistoria_sintomas
  FOR EACH ROW EXECUTE FUNCTION fn_sintomas_para_caso();

-- ── RPC: resumo do agente num ciclo ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION resumo_agente_ciclo(
  p_cliente_id  uuid,
  p_agente_id   uuid,
  p_ciclo       int
)
RETURNS json AS $$
DECLARE
  v_total       int;
  v_visitados   int;
  v_pendentes   int;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM imoveis
  WHERE cliente_id = p_cliente_id AND ativo = true;

  SELECT COUNT(*) INTO v_visitados
  FROM vistorias
  WHERE cliente_id = p_cliente_id
    AND agente_id  = p_agente_id
    AND ciclo      = p_ciclo
    AND status     IN ('visitado','fechado');

  v_pendentes := GREATEST(v_total - v_visitados, 0);

  RETURN json_build_object(
    'pendentes',     v_pendentes,
    'visitados',     v_visitados,
    'meta',          v_total,
    'cobertura_pct', CASE WHEN v_total > 0 THEN ROUND((v_visitados::numeric / v_total) * 100, 1) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
