-- Altera constraint de unicidade de quadras: de (cliente_id, codigo) global
-- para (cliente_id, bairro_id, codigo) — permite o mesmo código em bairros distintos.
ALTER TABLE bairros_quadras
  DROP CONSTRAINT IF EXISTS bairros_quadras_cliente_id_codigo_key;

CREATE UNIQUE INDEX IF NOT EXISTS bairros_quadras_cliente_id_bairro_id_codigo_key
  ON bairros_quadras (cliente_id, bairro_id, codigo);
