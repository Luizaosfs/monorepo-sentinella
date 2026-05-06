BEGIN;

-- 0000081: 1 tentativa (fechado_ausente), sem escalada
UPDATE focos_risco SET
  status = 'aguardando_nova_tentativa',
  tentativas_sem_acesso = 1,
  pendente_decisao_supervisor = false,
  updated_at = now()
WHERE id = '831b6ceb-b3fa-4c1e-95ae-952f4caf8592';

INSERT INTO foco_risco_historico (id, foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, alterado_em, tipo_evento, motivo)
SELECT gen_random_uuid(), f.id, f.cliente_id, 'em_inspecao', 'aguardando_nova_tentativa',
  (SELECT id FROM usuarios WHERE cliente_id = f.cliente_id LIMIT 1),
  now(), 'sem_acesso_registrado',
  'Sem acesso (fechado_ausente). Tentativa 1/3. Correcao manual de dados.'
FROM focos_risco f WHERE f.id = '831b6ceb-b3fa-4c1e-95ae-952f4caf8592';

-- 0000083: 1 tentativa (fechado_ausente), sem escalada
UPDATE focos_risco SET
  status = 'aguardando_nova_tentativa',
  tentativas_sem_acesso = 1,
  pendente_decisao_supervisor = false,
  updated_at = now()
WHERE id = '0fba5b4f-4d5a-4b39-b63e-0aa8d6af7c57';

INSERT INTO foco_risco_historico (id, foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, alterado_em, tipo_evento, motivo)
SELECT gen_random_uuid(), f.id, f.cliente_id, 'em_inspecao', 'aguardando_nova_tentativa',
  (SELECT id FROM usuarios WHERE cliente_id = f.cliente_id LIMIT 1),
  now(), 'sem_acesso_registrado',
  'Sem acesso (fechado_ausente). Tentativa 1/3. Correcao manual de dados.'
FROM focos_risco f WHERE f.id = '0fba5b4f-4d5a-4b39-b63e-0aa8d6af7c57';

-- 0000190: 2 tentativas (fechado_ausente + calha_inacessivel), ESCALADO ao supervisor
UPDATE focos_risco SET
  status = 'aguardando_nova_tentativa',
  tentativas_sem_acesso = 2,
  pendente_decisao_supervisor = true,
  updated_at = now()
WHERE id = '9d19712e-2986-49f9-866e-364c35a61a08';

INSERT INTO foco_risco_historico (id, foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, alterado_em, tipo_evento, motivo)
SELECT gen_random_uuid(), f.id, f.cliente_id, 'em_inspecao', 'aguardando_nova_tentativa',
  (SELECT id FROM usuarios WHERE cliente_id = f.cliente_id LIMIT 1),
  now(), 'escalado_supervisor',
  'Sem acesso (calha_inacessivel). Tentativa 2/3. Escalado ao supervisor. Correcao manual de dados.'
FROM focos_risco f WHERE f.id = '9d19712e-2986-49f9-866e-364c35a61a08';

COMMIT;
