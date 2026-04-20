-- QW-14 Sprint B3/B4 — Tabela de auditoria para ações críticas
--
-- Registra ações sensíveis: exclusão de usuário, troca de papel,
-- exportação de dados, force-sync CNES, geração de relatório manual.
-- Escrita exclusiva via service_role ou SECURITY DEFINER — nunca pelo cliente.

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        REFERENCES clientes(id) ON DELETE SET NULL,
  usuario_id  uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  auth_uid    uuid,                        -- auth.uid() no momento da ação
  acao        text        NOT NULL,        -- 'usuario_removido', 'papel_alterado', 'relatorio_gerado', etc.
  tabela      text,                        -- tabela afetada, se aplicável
  registro_id uuid,                        -- ID do registro afetado
  ip_hash     text,                        -- MD5 do IP para rastreabilidade sem expor dados
  descricao   text,                        -- Descrição legível da ação
  payload     jsonb,                       -- Dados extras sem informação sensível
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: admins do cliente lêem seus próprios logs; service_role escreve
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura_admin_audit_log" ON audit_log
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT u.cliente_id FROM usuarios u
      JOIN papeis_usuarios pu ON pu.usuario_id = u.id
      WHERE u.auth_id = auth.uid()
        AND LOWER(pu.papel::text) IN ('admin', 'supervisor')
    )
  );

-- Sem policy de escrita para authenticated — apenas service_role e SECURITY DEFINER
CREATE INDEX IF NOT EXISTS idx_audit_log_cliente_criado  ON audit_log (cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_acao            ON audit_log (acao, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario         ON audit_log (usuario_id, created_at DESC);

-- ─── Função helper para registrar ação (chamada via SECURITY DEFINER) ─────────

CREATE OR REPLACE FUNCTION registrar_audit(
  p_cliente_id  uuid,
  p_acao        text,
  p_tabela      text        DEFAULT NULL,
  p_registro_id uuid        DEFAULT NULL,
  p_descricao   text        DEFAULT NULL,
  p_payload     jsonb       DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_usuario_id uuid;
  v_ip_raw     text;
  v_ip_hash    text;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;

  BEGIN
    v_ip_raw := split_part(
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := 'unknown';
  END;

  v_ip_hash := md5(coalesce(nullif(trim(v_ip_raw), ''), 'unknown'));

  INSERT INTO audit_log (cliente_id, usuario_id, auth_uid, acao, tabela, registro_id, ip_hash, descricao, payload)
  VALUES (p_cliente_id, v_usuario_id, auth.uid(), p_acao, p_tabela, p_registro_id, v_ip_hash, p_descricao, p_payload);
END;
$$;

REVOKE ALL ON FUNCTION registrar_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_audit(uuid, text, text, uuid, text, jsonb) TO authenticated;

-- ─── Purga automática (retém 1 ano) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION purgar_audit_log_antigo()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM audit_log WHERE created_at < now() - interval '1 year';
$$;

-- ─── Ações que DEVEM ser auditadas (via api.ts ou Edge Functions) ─────────────
-- Chamar: SELECT registrar_audit(cliente_id, 'acao', 'tabela', id, 'descrição', payload)
--
-- | Ação                     | Onde chamar                        |
-- |--------------------------|-------------------------------------|
-- | usuario_removido         | api.usuarios.remove()              |
-- | papel_alterado           | api.usuarios.updatePapel()         |
-- | relatorio_gerado         | Edge Function relatorio-semanal    |
-- | force_sync_cnes          | api.cnesSync.sincronizarManual()   |
-- | export_csv               | AdminPainelMunicipios (download)   |
-- | integracao_api_key_vista | get_integracao_api_key() RPC       |
-- | cliente_suspenso         | AdminClientes (status change)      |
