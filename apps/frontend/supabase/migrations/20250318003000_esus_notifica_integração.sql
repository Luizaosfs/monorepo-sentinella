-- ── Credenciais de integração por cliente ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('esus_notifica', 'rnds')),
  api_key text NOT NULL,
  endpoint_url text NOT NULL DEFAULT 'https://notifica.saude.gov.br/api/notificacoes',
  codigo_ibge text,          -- Código IBGE do município (7 dígitos)
  unidade_saude_cnes text,   -- CNES da unidade notificante padrão
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  ativo boolean NOT NULL DEFAULT false,
  ultima_sincronizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, tipo)
);

ALTER TABLE cliente_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolamento_cliente_integracoes" ON cliente_integracoes
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE INDEX ON cliente_integracoes (cliente_id);

-- ── Auditoria de notificações enviadas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_notificacoes_esus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  levantamento_item_id uuid REFERENCES levantamento_itens(id) ON DELETE SET NULL,
  -- Identificação da notificação
  tipo_agravo text NOT NULL CHECK (tipo_agravo IN ('dengue', 'chikungunya', 'zika', 'suspeito')),
  numero_notificacao text,        -- Retorno da API (ID gerado pelo MS)
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'erro', 'descartado')),
  -- Dados enviados e resposta
  payload_enviado jsonb,
  resposta_api jsonb,
  erro_mensagem text,
  -- Auditoria
  enviado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE item_notificacoes_esus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolamento_item_notificacoes_esus" ON item_notificacoes_esus
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE INDEX ON item_notificacoes_esus (cliente_id);
CREATE INDEX ON item_notificacoes_esus (levantamento_item_id);
CREATE INDEX ON item_notificacoes_esus (status);
