-- Migration: push_subscriptions
-- Armazena as assinaturas Web Push dos usuários para notificações server-side.
-- A Edge Function sla-push-critico lê esta tabela para enviar push quando
-- prazo_final - now() < 1h.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  cliente_id   uuid        NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia apenas suas próprias assinaturas
CREATE POLICY "own_push_subscriptions" ON push_subscriptions
  USING (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_id = auth.uid()
    )
  );

-- Índices
CREATE INDEX ON push_subscriptions (cliente_id);
CREATE INDEX ON push_subscriptions (usuario_id);
