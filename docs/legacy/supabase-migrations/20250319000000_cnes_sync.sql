-- ============================================================
-- Migration: CNES/DATASUS Sync
-- Adiciona campos de municipio ao cliente, estende unidades_saude
-- e cria tabelas de controle e log da sincronização automática.
-- ============================================================

-- 1. Novos campos em clientes (município para busca no CNES)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS uf             char(2),
  ADD COLUMN IF NOT EXISTS ibge_municipio char(7);

COMMENT ON COLUMN clientes.uf             IS 'Sigla do estado (ex: SP, MS). Obrigatório para sincronização CNES.';
COMMENT ON COLUMN clientes.ibge_municipio IS 'Código IBGE do município com 7 dígitos. Obrigatório para sincronização CNES.';

-- 2. Novos campos em unidades_saude (dados vindos do CNES)
ALTER TABLE unidades_saude
  ADD COLUMN IF NOT EXISTS cnes            text,
  ADD COLUMN IF NOT EXISTS tipo_sentinela  text NOT NULL DEFAULT 'OUTRO'
                             CHECK (tipo_sentinela IN ('UBS','USF','UPA','HOSPITAL','CEM','VIGILANCIA','OUTRO')),
  ADD COLUMN IF NOT EXISTS telefone        text,
  ADD COLUMN IF NOT EXISTS bairro          text,
  ADD COLUMN IF NOT EXISTS municipio       text,
  ADD COLUMN IF NOT EXISTS uf              char(2),
  ADD COLUMN IF NOT EXISTS origem          text NOT NULL DEFAULT 'manual'
                             CHECK (origem IN ('manual','cnes_sync')),
  ADD COLUMN IF NOT EXISTS ultima_sync_em  timestamptz;

COMMENT ON COLUMN unidades_saude.cnes           IS 'Código CNES do estabelecimento (7 dígitos). Chave de upsert na sincronização.';
COMMENT ON COLUMN unidades_saude.tipo_sentinela IS 'Classificação interna do Sentinella (UBS, USF, UPA, HOSPITAL, CEM, VIGILANCIA, OUTRO).';
COMMENT ON COLUMN unidades_saude.origem         IS 'manual = cadastrado pela prefeitura; cnes_sync = importado do CNES/DATASUS.';
COMMENT ON COLUMN unidades_saude.ultima_sync_em IS 'Timestamp da última vez que este registro foi atualizado pela sincronização CNES.';

-- Índice único para upsert por (cliente_id, cnes)
CREATE UNIQUE INDEX IF NOT EXISTS unidades_saude_cliente_cnes_key
  ON unidades_saude (cliente_id, cnes)
  WHERE cnes IS NOT NULL;

-- 3. Tabela de controle de execuções de sincronização
CREATE TABLE IF NOT EXISTS unidades_saude_sync_controle (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','em_andamento','sucesso','erro')),
  origem_execucao   text        NOT NULL DEFAULT 'agendado'
                                CHECK (origem_execucao IN ('agendado','manual')),
  iniciado_em       timestamptz NOT NULL DEFAULT now(),
  finalizado_em     timestamptz,
  usuario_id        uuid        REFERENCES usuarios(id),
  total_recebidos   integer,
  total_inseridos   integer,
  total_atualizados integer,
  total_inativados  integer,
  erro_mensagem     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE unidades_saude_sync_controle IS 'Registro de cada execução de sincronização CNES (agendada ou manual). Uma linha por execução por cliente.';

ALTER TABLE unidades_saude_sync_controle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_controle_isolamento" ON unidades_saude_sync_controle
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS unidades_saude_sync_controle_cliente_idx
  ON unidades_saude_sync_controle (cliente_id, iniciado_em DESC);

-- 4. Tabela de log detalhado por estabelecimento
CREATE TABLE IF NOT EXISTS unidades_saude_sync_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id  uuid        NOT NULL REFERENCES unidades_saude_sync_controle(id) ON DELETE CASCADE,
  cliente_id   uuid        NOT NULL,
  cnes         text,
  acao         text        NOT NULL CHECK (acao IN ('inserido','atualizado','inativado','ignorado','erro')),
  mensagem     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE unidades_saude_sync_log IS 'Log linha a linha de cada estabelecimento processado numa execução de sync CNES. Permite auditoria completa.';

ALTER TABLE unidades_saude_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_isolamento" ON unidades_saude_sync_log
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS unidades_saude_sync_log_controle_idx
  ON unidades_saude_sync_log (controle_id);

CREATE INDEX IF NOT EXISTS unidades_saude_sync_log_cliente_idx
  ON unidades_saude_sync_log (cliente_id, created_at DESC);
