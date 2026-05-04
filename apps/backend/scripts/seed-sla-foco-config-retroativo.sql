-- Seed retroativo de sla_foco_config para clientes que não têm configuração
-- Criado porque SeedClienteNovo (Fase C.6) só popula clientes novos.
-- Idempotente via ON CONFLICT DO NOTHING (UNIQUE: cliente_id + fase).
--
-- Para um cliente específico: substitua WHERE c.deleted_at IS NULL
-- por WHERE c.id = 'SEU-UUID-AQUI'

INSERT INTO sla_foco_config (cliente_id, fase, prazo_minutos, ativo)
SELECT c.id, f.fase, f.prazo_minutos, true
FROM clientes c
CROSS JOIN (VALUES
  ('triagem',     480),
  ('inspecao',    720),
  ('confirmacao', 1440),
  ('tratamento',  2880)
) AS f(fase, prazo_minutos)
WHERE c.deleted_at IS NULL
ON CONFLICT (cliente_id, fase) DO NOTHING;
