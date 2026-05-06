BEGIN;

-- 1. Adicionar aguardando_nova_tentativa ao CHECK constraint
ALTER TABLE focos_risco DROP CONSTRAINT focos_risco_status_check;
ALTER TABLE focos_risco ADD CONSTRAINT focos_risco_status_check
  CHECK (status = ANY (ARRAY[
    'suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao',
    'confirmado', 'em_tratamento', 'resolvido', 'descartado',
    'aguardando_nova_tentativa'
  ]));

-- 2. Corrigir estado do foco 2026-00000092
UPDATE focos_risco
SET
  status = 'aguardando_nova_tentativa',
  tentativas_sem_acesso = 3,
  pendente_decisao_supervisor = true,
  updated_at = now()
WHERE id = 'a5240f32-b3af-4cb6-9b8e-e5178e96c8a6';

-- 3. Inserir historico
INSERT INTO foco_risco_historico (
  id,
  foco_risco_id,
  cliente_id,
  status_anterior,
  status_novo,
  alterado_por,
  alterado_em,
  tipo_evento,
  motivo
)
SELECT
  gen_random_uuid(),
  f.id,
  f.cliente_id,
  'em_inspecao',
  'aguardando_nova_tentativa',
  (SELECT id FROM usuarios WHERE cliente_id = f.cliente_id LIMIT 1),
  now(),
  'escalado_supervisor',
  'Sem acesso (3 tentativas). Escalado ao supervisor - correcao manual.'
FROM focos_risco f
WHERE f.id = 'a5240f32-b3af-4cb6-9b8e-e5178e96c8a6';

COMMIT;
