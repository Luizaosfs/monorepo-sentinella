-- =============================================================================
-- RLS GERAL — Políticas para todas as tabelas do Sentinella
-- Regra: usuário acessa dados do seu cliente (usuarios.cliente_id) ou de
-- qualquer cliente se for admin (papeis_usuarios.papel = 'admin').
-- Execute no SQL Editor do Supabase. Se cliente_id for TEXT (não UUID),
-- altere a função: p_cliente_id uuid -> p_cliente_id text.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funções auxiliares
-- -----------------------------------------------------------------------------

-- Usuário pode acessar um cliente? (é o seu cliente ou é admin)
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id = auth.uid()
    AND (
      u.cliente_id = p_cliente_id
      OR EXISTS (
        SELECT 1 FROM papeis_usuarios pu
        WHERE pu.usuario_id = u.auth_id AND pu.papel = 'admin'
      )
    )
  );
$$;

-- Usuário atual é admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    WHERE u.auth_id = auth.uid() AND pu.papel = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. CLIENTES — leitura se pode acessar o cliente; escrita só admin
-- -----------------------------------------------------------------------------
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(id));

DROP POLICY IF EXISTS "clientes_insert" ON clientes;
CREATE POLICY "clientes_insert" ON clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. USUARIOS — usuário vê o próprio registro; admin vê/edita todos
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select" ON usuarios;
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "usuarios_insert" ON usuarios;
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usuarios_update" ON usuarios;
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "usuarios_delete" ON usuarios;
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. PAPEIS_USUARIOS — só admin
-- -----------------------------------------------------------------------------
ALTER TABLE papeis_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "papeis_usuarios_select" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_select" ON papeis_usuarios FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "papeis_usuarios_insert" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_insert" ON papeis_usuarios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "papeis_usuarios_update" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_update" ON papeis_usuarios FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "papeis_usuarios_delete" ON papeis_usuarios;
CREATE POLICY "papeis_usuarios_delete" ON papeis_usuarios FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. REGIOES — por cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE regioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regioes_select" ON regioes;
CREATE POLICY "regioes_select" ON regioes FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "regioes_insert" ON regioes;
CREATE POLICY "regioes_insert" ON regioes FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "regioes_update" ON regioes;
CREATE POLICY "regioes_update" ON regioes FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "regioes_delete" ON regioes;
CREATE POLICY "regioes_delete" ON regioes FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 6. LEVANTAMENTOS — por cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE levantamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "levantamentos_select" ON levantamentos;
CREATE POLICY "levantamentos_select" ON levantamentos FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "levantamentos_insert" ON levantamentos;
CREATE POLICY "levantamentos_insert" ON levantamentos FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "levantamentos_update" ON levantamentos;
CREATE POLICY "levantamentos_update" ON levantamentos FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "levantamentos_delete" ON levantamentos;
CREATE POLICY "levantamentos_delete" ON levantamentos FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 7. LEVANTAMENTO_ITENS — via levantamento.cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE levantamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "levantamento_itens_select" ON levantamento_itens;
CREATE POLICY "levantamento_itens_select" ON levantamento_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM levantamentos l
      WHERE l.id = levantamento_itens.levantamento_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

DROP POLICY IF EXISTS "levantamento_itens_insert" ON levantamento_itens;
CREATE POLICY "levantamento_itens_insert" ON levantamento_itens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM levantamentos l
      WHERE l.id = levantamento_itens.levantamento_id
      AND public.usuario_pode_acessar_cliente(l.cliente_id)
    )
  );

DROP POLICY IF EXISTS "levantamento_itens_update" ON levantamento_itens;
CREATE POLICY "levantamento_itens_update" ON levantamento_itens FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM levantamentos l WHERE l.id = levantamento_itens.levantamento_id AND public.usuario_pode_acessar_cliente(l.cliente_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM levantamentos l WHERE l.id = levantamento_itens.levantamento_id AND public.usuario_pode_acessar_cliente(l.cliente_id))
  );

DROP POLICY IF EXISTS "levantamento_itens_delete" ON levantamento_itens;
CREATE POLICY "levantamento_itens_delete" ON levantamento_itens FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM levantamentos l WHERE l.id = levantamento_itens.levantamento_id AND public.usuario_pode_acessar_cliente(l.cliente_id))
  );

-- -----------------------------------------------------------------------------
-- 8. PLANEJAMENTO — por cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE planejamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planejamento_select" ON planejamento;
CREATE POLICY "planejamento_select" ON planejamento FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "planejamento_insert" ON planejamento;
CREATE POLICY "planejamento_insert" ON planejamento FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "planejamento_update" ON planejamento;
CREATE POLICY "planejamento_update" ON planejamento FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "planejamento_delete" ON planejamento;
CREATE POLICY "planejamento_delete" ON planejamento FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 9. VOOS — via planejamento.cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE voos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voos_select" ON voos;
CREATE POLICY "voos_select" ON voos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM planejamento p
      WHERE p.id = voos.planejamento_id
      AND public.usuario_pode_acessar_cliente(p.cliente_id)
    )
  );

DROP POLICY IF EXISTS "voos_insert" ON voos;
CREATE POLICY "voos_insert" ON voos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM planejamento p
      WHERE p.id = voos.planejamento_id
      AND public.usuario_pode_acessar_cliente(p.cliente_id)
    )
  );

DROP POLICY IF EXISTS "voos_update" ON voos;
CREATE POLICY "voos_update" ON voos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM planejamento p WHERE p.id = voos.planejamento_id AND public.usuario_pode_acessar_cliente(p.cliente_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM planejamento p WHERE p.id = voos.planejamento_id AND public.usuario_pode_acessar_cliente(p.cliente_id))
  );

DROP POLICY IF EXISTS "voos_delete" ON voos;
CREATE POLICY "voos_delete" ON voos FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM planejamento p WHERE p.id = voos.planejamento_id AND public.usuario_pode_acessar_cliente(p.cliente_id))
  );

-- -----------------------------------------------------------------------------
-- 10. DRONES — leitura para autenticados; escrita só admin (sem cliente_id)
-- -----------------------------------------------------------------------------
ALTER TABLE drones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drones_select" ON drones;
CREATE POLICY "drones_select" ON drones FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "drones_insert" ON drones;
CREATE POLICY "drones_insert" ON drones FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "drones_update" ON drones;
CREATE POLICY "drones_update" ON drones FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "drones_delete" ON drones;
CREATE POLICY "drones_delete" ON drones FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 11. PLUVIO_RISCO — via regiao.cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE pluvio_risco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pluvio_risco_select" ON pluvio_risco;
CREATE POLICY "pluvio_risco_select" ON pluvio_risco FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM regioes r
      WHERE r.id = pluvio_risco.regiao_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

DROP POLICY IF EXISTS "pluvio_risco_insert" ON pluvio_risco;
CREATE POLICY "pluvio_risco_insert" ON pluvio_risco FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM regioes r
      WHERE r.id = pluvio_risco.regiao_id
      AND public.usuario_pode_acessar_cliente(r.cliente_id)
    )
  );

DROP POLICY IF EXISTS "pluvio_risco_update" ON pluvio_risco;
CREATE POLICY "pluvio_risco_update" ON pluvio_risco FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM regioes r WHERE r.id = pluvio_risco.regiao_id AND public.usuario_pode_acessar_cliente(r.cliente_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM regioes r WHERE r.id = pluvio_risco.regiao_id AND public.usuario_pode_acessar_cliente(r.cliente_id))
  );

DROP POLICY IF EXISTS "pluvio_risco_delete" ON pluvio_risco;
CREATE POLICY "pluvio_risco_delete" ON pluvio_risco FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM regioes r WHERE r.id = pluvio_risco.regiao_id AND public.usuario_pode_acessar_cliente(r.cliente_id))
  );

-- -----------------------------------------------------------------------------
-- 12. PLUVIO_OPERACIONAL_RUN — por cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE pluvio_operacional_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pluvio_operacional_run_select" ON pluvio_operacional_run;
CREATE POLICY "pluvio_operacional_run_select" ON pluvio_operacional_run FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "pluvio_operacional_run_insert" ON pluvio_operacional_run;
CREATE POLICY "pluvio_operacional_run_insert" ON pluvio_operacional_run FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "pluvio_operacional_run_update" ON pluvio_operacional_run;
CREATE POLICY "pluvio_operacional_run_update" ON pluvio_operacional_run FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id))
  WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id));

DROP POLICY IF EXISTS "pluvio_operacional_run_delete" ON pluvio_operacional_run;
CREATE POLICY "pluvio_operacional_run_delete" ON pluvio_operacional_run FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- -----------------------------------------------------------------------------
-- 13. PLUVIO_OPERACIONAL_ITEM — via run.cliente_id
-- -----------------------------------------------------------------------------
ALTER TABLE pluvio_operacional_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pluvio_operacional_item_select" ON pluvio_operacional_item;
CREATE POLICY "pluvio_operacional_item_select" ON pluvio_operacional_item FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_run run
      WHERE run.id = pluvio_operacional_item.run_id
      AND public.usuario_pode_acessar_cliente(run.cliente_id)
    )
  );

DROP POLICY IF EXISTS "pluvio_operacional_item_insert" ON pluvio_operacional_item;
CREATE POLICY "pluvio_operacional_item_insert" ON pluvio_operacional_item FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pluvio_operacional_run run
      WHERE run.id = pluvio_operacional_item.run_id
      AND public.usuario_pode_acessar_cliente(run.cliente_id)
    )
  );

DROP POLICY IF EXISTS "pluvio_operacional_item_update" ON pluvio_operacional_item;
CREATE POLICY "pluvio_operacional_item_update" ON pluvio_operacional_item FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pluvio_operacional_run run WHERE run.id = pluvio_operacional_item.run_id AND public.usuario_pode_acessar_cliente(run.cliente_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pluvio_operacional_run run WHERE run.id = pluvio_operacional_item.run_id AND public.usuario_pode_acessar_cliente(run.cliente_id))
  );

DROP POLICY IF EXISTS "pluvio_operacional_item_delete" ON pluvio_operacional_item;
CREATE POLICY "pluvio_operacional_item_delete" ON pluvio_operacional_item FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pluvio_operacional_run run WHERE run.id = pluvio_operacional_item.run_id AND public.usuario_pode_acessar_cliente(run.cliente_id))
  );

-- -----------------------------------------------------------------------------
-- 14. SENTINELA_RISK_POLICY — por cliente_id (se a tabela existir)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sentinela_risk_policy') THEN
    EXECUTE 'ALTER TABLE sentinela_risk_policy ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "sentinela_risk_policy_select" ON sentinela_risk_policy';
    EXECUTE 'CREATE POLICY "sentinela_risk_policy_select" ON sentinela_risk_policy FOR SELECT TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id))';
    EXECUTE 'DROP POLICY IF EXISTS "sentinela_risk_policy_insert" ON sentinela_risk_policy';
    EXECUTE 'CREATE POLICY "sentinela_risk_policy_insert" ON sentinela_risk_policy FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id))';
    EXECUTE 'DROP POLICY IF EXISTS "sentinela_risk_policy_update" ON sentinela_risk_policy';
    EXECUTE 'CREATE POLICY "sentinela_risk_policy_update" ON sentinela_risk_policy FOR UPDATE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id)) WITH CHECK (public.usuario_pode_acessar_cliente(cliente_id))';
    EXECUTE 'DROP POLICY IF EXISTS "sentinela_risk_policy_delete" ON sentinela_risk_policy';
    EXECUTE 'CREATE POLICY "sentinela_risk_policy_delete" ON sentinela_risk_policy FOR DELETE TO authenticated USING (public.usuario_pode_acessar_cliente(cliente_id))';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 15. Tabelas sentinela_risk_* (filhas de policy) — por policy.cliente_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_risk_policy(p_policy_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sentinela_risk_policy p
    WHERE p.id = p_policy_id
    AND public.usuario_pode_acessar_cliente(p.cliente_id)
  );
$$;

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'sentinela_risk_defaults', 'sentinela_risk_bin_sem_chuva', 'sentinela_risk_bin_intensidade_chuva',
    'sentinela_risk_bin_persistencia_7d', 'sentinela_risk_fallback_rule', 'sentinela_risk_rule',
    'sentinela_risk_temp_factor', 'sentinela_risk_vento_factor',
    'sentinela_risk_temp_adjust_pp', 'sentinela_risk_vento_adjust_pp', 'sentinela_risk_persistencia_adjust_pp', 'sentinela_risk_tendencia_adjust_pp'
  ];
BEGIN
  FOREACH t IN ARRAY tbls
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.usuario_pode_acessar_risk_policy(policy_id))', t || '_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_acessar_risk_policy(policy_id))', t || '_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (public.usuario_pode_acessar_risk_policy(policy_id)) WITH CHECK (public.usuario_pode_acessar_risk_policy(policy_id))', t || '_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (public.usuario_pode_acessar_risk_policy(policy_id))', t || '_delete', t);
    END IF;
  END LOOP;
END $$;
