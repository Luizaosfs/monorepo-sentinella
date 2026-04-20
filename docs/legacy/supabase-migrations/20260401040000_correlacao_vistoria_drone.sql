CREATE TABLE IF NOT EXISTS vistoria_drone_correlacao (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id           uuid        NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
  levantamento_item_id  uuid        NOT NULL REFERENCES levantamento_itens(id) ON DELETE CASCADE,
  cliente_id            uuid        NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  distancia_metros      numeric     NOT NULL,
  drone_detectou_foco   boolean     NOT NULL,
  campo_confirmou_foco  boolean,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vistoria_id, levantamento_item_id)
);

CREATE INDEX IF NOT EXISTS idx_vistoria_drone_correlacao_cliente ON vistoria_drone_correlacao (cliente_id);
CREATE INDEX IF NOT EXISTS idx_vistoria_drone_correlacao_item ON vistoria_drone_correlacao (levantamento_item_id);

ALTER TABLE vistoria_drone_correlacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corr_isolamento" ON vistoria_drone_correlacao;
CREATE POLICY "corr_isolamento" ON vistoria_drone_correlacao
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION fn_correlacionar_vistoria_com_drone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'visitado' AND (OLD.status IS NULL OR OLD.status != 'visitado') THEN
    INSERT INTO vistoria_drone_correlacao (
      vistoria_id, levantamento_item_id, cliente_id, distancia_metros, drone_detectou_foco
    )
    SELECT
      NEW.id,
      li.id,
      NEW.cliente_id,
      ST_Distance(
        ST_MakePoint(im.longitude, im.latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography
      ),
      (li.risco NOT IN ('sem risco', 'baixo') OR li.risco IS NULL)
    FROM imoveis im
    JOIN levantamento_itens li ON li.cliente_id = NEW.cliente_id
    JOIN levantamentos l ON l.id = li.levantamento_id
    WHERE im.id = NEW.imovel_id
      AND im.latitude IS NOT NULL AND im.longitude IS NOT NULL
      AND li.latitude IS NOT NULL AND li.longitude IS NOT NULL
      AND ST_DWithin(
        ST_MakePoint(im.longitude, im.latitude)::geography,
        ST_MakePoint(li.longitude, li.latitude)::geography,
        50
      )
      AND l.created_at >= now() - interval '90 days'
    ON CONFLICT (vistoria_id, levantamento_item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_correlacionar_vistoria_drone ON vistorias;
CREATE TRIGGER trg_correlacionar_vistoria_drone
  AFTER UPDATE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION fn_correlacionar_vistoria_com_drone();
