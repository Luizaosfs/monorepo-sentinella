CREATE TABLE IF NOT EXISTS resumos_diarios (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data_ref    date        NOT NULL,
  sumario     text        NOT NULL,
  metricas    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_resumos_diarios_cliente_data ON resumos_diarios (cliente_id, data_ref DESC);

ALTER TABLE resumos_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumos_isolamento" ON resumos_diarios;
CREATE POLICY "resumos_isolamento" ON resumos_diarios
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));
