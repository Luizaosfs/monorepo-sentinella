-- =============================================================================
-- Fix Security: registrar_audit() — validar tenant antes de inserir
-- =============================================================================

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
  -- Usuário só pode registrar auditoria do próprio cliente.
  -- Admin pode registrar para qualquer cliente (suporte de plataforma).
  IF p_cliente_id IS NOT NULL
     AND NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION
      'registrar_audit: acesso negado — cliente_id não pertence ao usuário';
  END IF;

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

  INSERT INTO audit_log (
    cliente_id, usuario_id, auth_uid, acao,
    tabela, registro_id, ip_hash, descricao, payload
  ) VALUES (
    p_cliente_id, v_usuario_id, auth.uid(), p_acao,
    p_tabela, p_registro_id, v_ip_hash, p_descricao, p_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_audit(uuid, text, text, uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION registrar_audit(uuid, text, text, uuid, text, jsonb) IS
  'Registra ação no audit_log. Valida tenant antes de inserir. (Fix S-05)';
