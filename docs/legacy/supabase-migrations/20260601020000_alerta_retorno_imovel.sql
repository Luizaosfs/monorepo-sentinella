-- Alertas automáticos de retorno para imóveis com acesso não realizado

CREATE TABLE IF NOT EXISTS alerta_retorno_imovel (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  imovel_id     uuid        NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  agente_id     uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ciclo         int         NOT NULL,
  vistoria_id   uuid        REFERENCES vistorias(id) ON DELETE SET NULL,
  motivo        text        NOT NULL,
  retorno_em    timestamptz NOT NULL,
  resolvido     boolean     NOT NULL DEFAULT false,
  resolvido_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alerta_retorno_imovel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerta_retorno_isolamento" ON alerta_retorno_imovel
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX IF NOT EXISTS idx_alerta_retorno_agente_pendente
  ON alerta_retorno_imovel (agente_id, retorno_em)
  WHERE resolvido = false;

CREATE INDEX IF NOT EXISTS idx_alerta_retorno_cliente
  ON alerta_retorno_imovel (cliente_id, retorno_em)
  WHERE resolvido = false;

COMMENT ON TABLE alerta_retorno_imovel IS
  'Alertas de retorno gerados automaticamente após vistoria sem acesso. '
  'Regras: fechado_ausente/cachorro_bravo → 24h; fechado_viagem → 48h; recusa_entrada → sem alerta.';
