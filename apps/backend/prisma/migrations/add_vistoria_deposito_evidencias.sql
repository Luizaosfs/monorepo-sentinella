-- PR-01: evidências fotográficas de depósitos PNCD
-- Aplicar com: psql $DATABASE_URL -f prisma/migrations/add_vistoria_deposito_evidencias.sql
-- Após aplicar: pnpm --filter backend generate

CREATE TABLE IF NOT EXISTS vistoria_deposito_evidencias (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id     uuid        NOT NULL,
  vistoria_id    uuid        NOT NULL REFERENCES vistorias(id),
  tipo_deposito  text        NOT NULL,
  tipo_imagem    text        NOT NULL CHECK (tipo_imagem IN ('antes', 'depois')),
  url_original   text        NOT NULL,
  url_thumbnail  text,
  public_id      text        NOT NULL,
  tamanho_bytes  integer,
  mime_type      text,
  capturada_em   timestamptz,
  status_upload  text        NOT NULL DEFAULT 'enviado' CHECK (status_upload IN ('pendente', 'enviado', 'erro')),
  ia_status      text        NOT NULL DEFAULT 'nao_analisada' CHECK (ia_status IN ('nao_analisada', 'pendente', 'analisada', 'erro')),
  ia_resultado   jsonb,
  ia_confianca   double precision,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vde_cliente_id    ON vistoria_deposito_evidencias (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vde_vistoria_id   ON vistoria_deposito_evidencias (vistoria_id);
CREATE INDEX IF NOT EXISTS idx_vde_tipo_deposito ON vistoria_deposito_evidencias (tipo_deposito);
CREATE INDEX IF NOT EXISTS idx_vde_tipo_imagem   ON vistoria_deposito_evidencias (tipo_imagem);
CREATE INDEX IF NOT EXISTS idx_vde_status_upload ON vistoria_deposito_evidencias (status_upload);
CREATE INDEX IF NOT EXISTS idx_vde_ia_status     ON vistoria_deposito_evidencias (ia_status);
