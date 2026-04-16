-- QW-15 — Billing: tabelas planos + cliente_plano
-- Define o catálogo de planos SaaS e o vínculo contratual por cliente.

-- ─── Extensão de UUID (garantir disponibilidade) ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. Catálogo de planos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planos (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                    text        NOT NULL UNIQUE,           -- 'basico', 'profissional', 'enterprise'
  descricao               text,
  preco_mensal            numeric(10,2),
  limite_usuarios         int,                                   -- NULL = ilimitado
  limite_imoveis          int,
  limite_vistorias_mes    int,
  limite_levantamentos_mes int,
  limite_voos_mes         int,
  limite_storage_gb       numeric(10,2),
  limite_ia_calls_mes     int,
  limite_denuncias_mes    int,
  drone_habilitado        boolean     NOT NULL DEFAULT false,
  sla_avancado            boolean     NOT NULL DEFAULT false,
  integracoes_habilitadas text[]      NOT NULL DEFAULT '{}',
  ativo                   boolean     NOT NULL DEFAULT true,
  ordem                   int         NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE planos IS 'Catálogo de planos SaaS Sentinella. Gerenciado pelo admin plataforma.';

-- RLS: leitura pública para usuários autenticados; escrita apenas service_role
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos_select" ON planos FOR SELECT TO authenticated USING (true);

-- ─── Seed dos 3 planos base ──────────────────────────────────────────────────

INSERT INTO planos (nome, descricao, preco_mensal,
  limite_usuarios, limite_imoveis, limite_vistorias_mes,
  limite_levantamentos_mes, limite_voos_mes, limite_storage_gb,
  limite_ia_calls_mes, limite_denuncias_mes,
  drone_habilitado, sla_avancado, integracoes_habilitadas, ordem)
VALUES
  ('basico',
   'Municípios pequenos — até 50 mil habitantes. Operação manual predominante.',
   900.00,
   10, 2000, 500, 5, 0, 5.0, 100, 200,
   false, false, ARRAY['esus'], 1),

  ('profissional',
   'Municípios médios — 50–200 mil habitantes. Drone incluso.',
   3000.00,
   30, 10000, 3000, 20, 10, 30.0, 500, NULL,
   true, true, ARRAY['esus','cnes'], 2),

  ('enterprise',
   'Municípios grandes — acima de 200 mil habitantes. Tudo ilimitado.',
   NULL,
   NULL, NULL, NULL, NULL, NULL, 100.0, NULL, NULL,
   true, true, ARRAY['esus','cnes','webhook'], 3)
ON CONFLICT (nome) DO NOTHING;

-- ─── 2. Vínculo contratual por cliente ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS cliente_plano (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id             uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plano_id               uuid        NOT NULL REFERENCES planos(id),
  data_inicio            date        NOT NULL DEFAULT CURRENT_DATE,
  data_fim               date,                                   -- NULL = sem prazo
  status                 text        NOT NULL DEFAULT 'ativo'
                           CHECK (status IN ('ativo','suspenso','cancelado','inadimplente')),
  limites_personalizados jsonb,                                  -- override de limites do plano base
  contrato_ref           text,                                   -- número do contrato público
  observacao             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id)                                            -- 1 plano ativo por cliente
);

COMMENT ON TABLE cliente_plano IS
  'Vínculo contratual entre cliente e plano SaaS. '
  'limites_personalizados sobrepõe os limites do plano base (negociação por contrato).';

ALTER TABLE cliente_plano ENABLE ROW LEVEL SECURITY;

-- Admin e supervisor do cliente podem ler
CREATE POLICY "leitura_admin_cliente_plano" ON cliente_plano
  FOR SELECT USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) IN ('admin','supervisor')
    )
  );

-- Escrita apenas service_role (admin plataforma via Supabase Dashboard)
CREATE INDEX IF NOT EXISTS idx_cliente_plano_cliente ON cliente_plano (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_plano_plano   ON cliente_plano (plano_id);

-- ─── 3. Trigger: ao criar cliente, associar ao plano básico ─────────────────

CREATE OR REPLACE FUNCTION trg_seed_cliente_plano()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plano_basico_id uuid;
BEGIN
  SELECT id INTO v_plano_basico_id FROM planos WHERE nome = 'basico' LIMIT 1;
  IF v_plano_basico_id IS NOT NULL THEN
    INSERT INTO cliente_plano (cliente_id, plano_id)
    VALUES (NEW.id, v_plano_basico_id)
    ON CONFLICT (cliente_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_cliente_plano_on_insert ON clientes;
CREATE TRIGGER trg_seed_cliente_plano_on_insert
  AFTER INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION trg_seed_cliente_plano();

-- Backfill: vincular clientes existentes sem plano ao plano básico
INSERT INTO cliente_plano (cliente_id, plano_id)
SELECT c.id, p.id
FROM clientes c
CROSS JOIN planos p
WHERE p.nome = 'basico'
  AND NOT EXISTS (
    SELECT 1 FROM cliente_plano cp WHERE cp.cliente_id = c.id
  );
