-- Import log: rastreia cada importação em lote de imóveis.
-- Permite auditoria, reprocessamento e relatório de erros por prefeitura.

CREATE TABLE import_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  criado_por   uuid,
  filename     text        NOT NULL,
  total_linhas int         NOT NULL DEFAULT 0,
  importados   int         NOT NULL DEFAULT 0,
  com_erro     int         NOT NULL DEFAULT 0,
  ignorados    int         NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'em_andamento'
               CHECK (status IN ('em_andamento', 'concluido', 'falhou')),
  erros        jsonb,      -- [{ linha, campo, mensagem }]
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolamento_por_cliente" ON import_log
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX idx_import_log_cliente_created ON import_log (cliente_id, created_at DESC);
