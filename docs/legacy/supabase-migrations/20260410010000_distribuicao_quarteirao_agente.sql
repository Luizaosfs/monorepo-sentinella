-- Atribuição de quarteirões a agentes por ciclo.
CREATE TABLE IF NOT EXISTS distribuicao_quarteirao (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ciclo        integer     NOT NULL CHECK (ciclo BETWEEN 1 AND 6),
  quarteirao   text        NOT NULL,
  agente_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  regiao_id    uuid        REFERENCES regioes(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ciclo, quarteirao)
);

CREATE INDEX IF NOT EXISTS idx_dist_quarteirao_cliente_ciclo
  ON distribuicao_quarteirao (cliente_id, ciclo);

CREATE INDEX IF NOT EXISTS idx_dist_quarteirao_agente
  ON distribuicao_quarteirao (agente_id, ciclo);

ALTER TABLE distribuicao_quarteirao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dist_quarteirao_isolamento" ON distribuicao_quarteirao;
CREATE POLICY "dist_quarteirao_isolamento" ON distribuicao_quarteirao
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

-- Trigger para updated_at sem dependência da extensão moddatetime
CREATE OR REPLACE FUNCTION trg_set_updated_at_dist_quarteirao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dist_quarteirao_updated_at ON distribuicao_quarteirao;
CREATE TRIGGER trg_dist_quarteirao_updated_at
  BEFORE UPDATE ON distribuicao_quarteirao
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_dist_quarteirao();
