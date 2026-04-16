-- =============================================================================
-- P1-3: Auditoria de eventos sensíveis
--
-- COBERTURA ADICIONADA:
--   papeis_usuarios   → papel_atribuido / papel_alterado / papel_removido
--   cliente_plano     → tenant_suspenso / tenant_cancelado / plano_alterado
--                       tenant_inadimplente / tenant_reativado / tenant_trial_iniciado
--   cliente_integracoes → integracao_criada / integracao_alterada / integracao_removida
--   usuarios          → usuario_desativado / usuario_reativado / usuario_removido
--
-- COBERTURA EXISTENTE (mantida):
--   get_integracao_api_key() → integracao_api_key_vista  (P0-3, migration 20261014000003)
--   sla_config               → INSERT/UPDATE/DELETE       (migration 20250309120000)
--
-- MODELO DE AUDITORIA:
--   quem   → auth_uid + usuario_id
--   quando → created_at (timestamptz, imutável)
--   tenant → cliente_id
--   ação   → acao (text, indexado)
--   entidade → tabela + registro_id
--   payload → jsonb seguro (NUNCA api_key, senha ou segredos)
--
-- RETENÇÃO: 2 anos (upgraded de 1 ano anterior)
--
-- SEGURANÇA:
--   fn_insert_audit_log() — helper interno; REVOKE de PUBLIC
--   Auditoria fail-safe: EXCEPTION dentro de trigger nunca bloqueia a operação
--   payload de integrações: só tipo/ambiente/flag (api_key_alterada: bool)
-- =============================================================================

-- ── Helper interno: insert direto em audit_log (sem verificação de tenant) ────
--
-- Usado pelos triggers abaixo. Separado de registrar_audit() (que é público e
-- faz verificação de tenant) para evitar conflito em triggers SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.fn_insert_audit_log(
  p_cliente_id  uuid,
  p_acao        text,
  p_tabela      text,
  p_registro_id uuid,
  p_descricao   text,
  p_payload     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_auth_uid   uuid;
BEGIN
  v_auth_uid   := auth.uid();  -- null em contexto service_role; aceito
  SELECT id INTO v_usuario_id FROM public.usuarios WHERE auth_id = v_auth_uid LIMIT 1;

  INSERT INTO public.audit_log(
    cliente_id, usuario_id, auth_uid,
    acao, tabela, registro_id,
    descricao, payload
  ) VALUES (
    p_cliente_id, v_usuario_id, v_auth_uid,
    p_acao, p_tabela, p_registro_id,
    p_descricao, COALESCE(p_payload, '{}')
  );
EXCEPTION WHEN OTHERS THEN
  -- Auditoria nunca deve bloquear a operação principal
  NULL;
END;
$$;

-- Função interna: apenas service_role e triggers (SECURITY DEFINER) podem chamar
REVOKE ALL ON FUNCTION public.fn_insert_audit_log(uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_insert_audit_log(uuid, text, text, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.fn_insert_audit_log IS
  'P1-3: Helper interno para triggers de auditoria. '
  'Não tem verificação de tenant (triggers são confiáveis). '
  'Fail-safe: EXCEPTION é silenciado para não bloquear operações.';

-- ── 1. papeis_usuarios — papel_atribuido / papel_alterado / papel_removido ────
--
-- NOTA: papeis_usuarios.usuario_id = auth.uid() (UUID do auth.users),
--       NÃO é o id interno da tabela usuarios. Resolver cliente_id via auth_id.
CREATE OR REPLACE FUNCTION public.fn_audit_papeis_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_uid        uuid;
  v_acao       text;
  v_descricao  text;
  v_payload    jsonb;
BEGIN
  -- papeis_usuarios.usuario_id é o auth.uid() do usuário alvo (não o invocador)
  v_uid := COALESCE(NEW.usuario_id, OLD.usuario_id);
  SELECT u.cliente_id INTO v_cliente_id
  FROM   public.usuarios u
  WHERE  u.auth_id = v_uid
  LIMIT  1;

  IF TG_OP = 'INSERT' THEN
    v_acao      := 'papel_atribuido';
    v_descricao := 'Papel atribuído: ' || NEW.papel::text;
    v_payload   := jsonb_build_object('papel', NEW.papel, 'usuario_auth_id', NEW.usuario_id);

  ELSIF TG_OP = 'UPDATE' THEN
    v_acao      := 'papel_alterado';
    v_descricao := 'Papel alterado: ' || OLD.papel::text || ' → ' || NEW.papel::text;
    v_payload   := jsonb_build_object(
      'papel_anterior', OLD.papel,
      'papel_novo',     NEW.papel,
      'usuario_auth_id', NEW.usuario_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_acao      := 'papel_removido';
    v_descricao := 'Papel removido: ' || OLD.papel::text;
    v_payload   := jsonb_build_object('papel', OLD.papel, 'usuario_auth_id', OLD.usuario_id);
  END IF;

  PERFORM public.fn_insert_audit_log(
    v_cliente_id, v_acao, 'papeis_usuarios', v_uid, v_descricao, v_payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_papeis_usuarios ON public.papeis_usuarios;
CREATE TRIGGER trg_audit_papeis_usuarios
  AFTER INSERT OR UPDATE OR DELETE ON public.papeis_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_papeis_usuarios();

COMMENT ON FUNCTION public.fn_audit_papeis_usuarios() IS
  'P1-3: Audita INSERT/UPDATE/DELETE em papeis_usuarios. '
  'Acoes: papel_atribuido, papel_alterado, papel_removido.';

-- ── 2. cliente_plano — mudanças de status e de plano ─────────────────────────
--
-- Eventos de bloqueio (suspenso/cancelado) são críticos para conformidade SaaS.
-- trial_iniciado e inadimplente são alertas operacionais.
CREATE OR REPLACE FUNCTION public.fn_audit_cliente_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao      text;
  v_descricao text;
  v_payload   jsonb;
BEGIN
  -- Ignorar se nada relevante mudou
  IF OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.plano_id IS NOT DISTINCT FROM NEW.plano_id THEN
    RETURN NEW;
  END IF;

  -- Determinar ação pelo novo status (status tem prioridade sobre plano)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_acao := CASE NEW.status
      WHEN 'suspenso'     THEN 'tenant_suspenso'
      WHEN 'cancelado'    THEN 'tenant_cancelado'
      WHEN 'inadimplente' THEN 'tenant_inadimplente'
      WHEN 'trial'        THEN 'tenant_trial_iniciado'
      WHEN 'ativo'        THEN 'tenant_reativado'
      ELSE                     'plano_status_alterado'
    END;
  ELSE
    v_acao := 'plano_alterado';
  END IF;

  v_descricao := 'Status: ' || OLD.status || ' → ' || NEW.status;
  IF OLD.plano_id IS DISTINCT FROM NEW.plano_id THEN
    v_descricao := v_descricao || '; plano alterado';
  END IF;

  v_payload := jsonb_build_object(
    'status_anterior',   OLD.status,
    'status_novo',       NEW.status,
    'plano_id_anterior', OLD.plano_id,
    'plano_id_novo',     NEW.plano_id,
    'data_trial_fim',    NEW.data_trial_fim
  );

  PERFORM public.fn_insert_audit_log(
    NEW.cliente_id, v_acao, 'cliente_plano', NEW.id, v_descricao, v_payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cliente_plano ON public.cliente_plano;
CREATE TRIGGER trg_audit_cliente_plano
  AFTER UPDATE ON public.cliente_plano
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_cliente_plano();

COMMENT ON FUNCTION public.fn_audit_cliente_plano() IS
  'P1-3: Audita mudanças de status e plano em cliente_plano. '
  'Acoes: tenant_suspenso, tenant_cancelado, tenant_inadimplente, '
  'tenant_reativado, tenant_trial_iniciado, plano_alterado.';

-- ── 3. cliente_integracoes — criação / alteração / remoção ────────────────────
--
-- SEGURANÇA CRÍTICA: payload NUNCA contém api_key, api_secret ou qualquer segredo.
-- Apenas: tipo, ambiente, ativo, e flag booleana se api_key foi trocada.
CREATE OR REPLACE FUNCTION public.fn_audit_integracoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao      text;
  v_descricao text;
  v_payload   jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao      := 'integracao_criada';
    v_descricao := 'Integração criada: ' || NEW.tipo;
    v_payload   := jsonb_build_object(
      'tipo',      NEW.tipo,
      'ambiente',  NEW.ambiente,
      'ativo',     NEW.ativo
      -- api_key NUNCA logada
    );
    PERFORM public.fn_insert_audit_log(
      NEW.cliente_id, v_acao, 'cliente_integracoes', NEW.id, v_descricao, v_payload
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_acao      := 'integracao_alterada';
    v_descricao := 'Integração alterada: ' || NEW.tipo;
    v_payload   := jsonb_build_object(
      'tipo',              NEW.tipo,
      'ambiente_anterior', OLD.ambiente,
      'ambiente_novo',     NEW.ambiente,
      'ativo_anterior',    OLD.ativo,
      'ativo_novo',        NEW.ativo,
      -- Indica SE a chave mudou, nunca O VALOR
      'api_key_alterada',  (OLD.api_key IS DISTINCT FROM NEW.api_key)
    );
    PERFORM public.fn_insert_audit_log(
      NEW.cliente_id, v_acao, 'cliente_integracoes', NEW.id, v_descricao, v_payload
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_acao      := 'integracao_removida';
    v_descricao := 'Integração removida: ' || OLD.tipo;
    v_payload   := jsonb_build_object('tipo', OLD.tipo, 'ambiente', OLD.ambiente);
    PERFORM public.fn_insert_audit_log(
      OLD.cliente_id, v_acao, 'cliente_integracoes', OLD.id, v_descricao, v_payload
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_integracoes ON public.cliente_integracoes;
CREATE TRIGGER trg_audit_integracoes
  AFTER INSERT OR UPDATE OR DELETE ON public.cliente_integracoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_integracoes();

COMMENT ON FUNCTION public.fn_audit_integracoes() IS
  'P1-3: Audita INSERT/UPDATE/DELETE em cliente_integracoes. '
  'SEGURANÇA: payload nunca contém api_key ou segredos — apenas flag api_key_alterada (bool).';

-- ── 4. usuarios — desativação / reativação / remoção ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_usuarios_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao      text;
  v_descricao text;
  v_payload   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_acao      := 'usuario_removido';
    v_descricao := 'Usuário removido: ' || COALESCE(OLD.email, OLD.id::text);
    v_payload   := jsonb_build_object('email', OLD.email);
    PERFORM public.fn_insert_audit_log(
      OLD.cliente_id, v_acao, 'usuarios', OLD.id, v_descricao, v_payload
    );
    RETURN OLD;
  END IF;

  -- UPDATE: auditar apenas mudanças de ativo
  IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    v_acao := CASE WHEN NEW.ativo THEN 'usuario_reativado' ELSE 'usuario_desativado' END;
    v_descricao := 'Usuário ' || CASE WHEN NEW.ativo THEN 'reativado' ELSE 'desativado' END
                 || ': ' || COALESCE(NEW.email, NEW.id::text);
    v_payload   := jsonb_build_object(
      'email',          NEW.email,
      'ativo_anterior', OLD.ativo,
      'ativo_novo',     NEW.ativo
    );
    PERFORM public.fn_insert_audit_log(
      NEW.cliente_id, v_acao, 'usuarios', NEW.id, v_descricao, v_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_usuarios_status ON public.usuarios;
CREATE TRIGGER trg_audit_usuarios_status
  AFTER UPDATE OR DELETE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_usuarios_status();

COMMENT ON FUNCTION public.fn_audit_usuarios_status() IS
  'P1-3: Audita desativação, reativação e remoção de usuários. '
  'Acoes: usuario_desativado, usuario_reativado, usuario_removido.';

-- ── 5. Corrigir purgar_audit_log_antigo — search_path + retorno + retenção ────
DROP FUNCTION IF EXISTS public.purgar_audit_log_antigo();
CREATE OR REPLACE FUNCTION public.purgar_audit_log_antigo()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deletados int;
BEGIN
  DELETE FROM public.audit_log WHERE created_at < now() - interval '2 years';
  GET DIAGNOSTICS v_deletados = ROW_COUNT;
  RETURN v_deletados;
END;
$$;

COMMENT ON FUNCTION public.purgar_audit_log_antigo() IS
  'P1-3: Purga audit_log com mais de 2 anos. '
  'Retorna número de registros deletados. '
  'Agendar no Supabase Dashboard → Edge Functions → Cron: "0 3 1 * *" (1º dia do mês 03h UTC).';

-- ── 6. RLS — SELECT em audit_log para admin e supervisor do tenant ─────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_admin"      ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_definer"    ON public.audit_log;

-- SELECT: admin vê tudo; supervisor vê apenas o próprio tenant
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.usuario_pode_acessar_cliente(cliente_id)
    )
  );

-- INSERT: apenas via funções SECURITY DEFINER (registrar_audit + fn_insert_audit_log)
-- Usuários autenticados nunca inserem diretamente
CREATE POLICY "audit_log_insert_deny" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- =============================================================================
-- RELATÓRIO DE COBERTURA DE AUDITORIA — P1-3
--
-- EVENTO                    | MECANISMO       | MIGRATION
-- --------------------------|-----------------|------------------------------
-- papel_atribuido           | trigger DB      | este arquivo
-- papel_alterado            | trigger DB      | este arquivo
-- papel_removido            | trigger DB      | este arquivo
-- tenant_suspenso           | trigger DB      | este arquivo
-- tenant_cancelado          | trigger DB      | este arquivo
-- tenant_inadimplente       | trigger DB      | este arquivo
-- tenant_reativado          | trigger DB      | este arquivo
-- tenant_trial_iniciado     | trigger DB      | este arquivo
-- plano_alterado            | trigger DB      | este arquivo
-- integracao_criada         | trigger DB      | este arquivo
-- integracao_alterada       | trigger DB      | este arquivo
-- integracao_removida       | trigger DB      | este arquivo
-- usuario_desativado        | trigger DB      | este arquivo
-- usuario_reativado         | trigger DB      | este arquivo
-- usuario_removido          | trigger DB      | este arquivo
-- integracao_api_key_vista  | RPC manual      | 20261014000003
-- sla_config INSERT/UPDATE  | trigger DB      | 20250309120000
-- force_sync_cnes           | RPC frontend    | api.ts (ver abaixo)
-- foco status transitions   | foco_risco_historico | 20260710000000
-- levantamento_item status  | levantamento_item_status_historico | 20250311100000
--
-- NÃO AUDITADO (sem mecanismo automático viável):
--   export_csv              → ação discreta no frontend; sem trigger DB possível
--   login/logout            → Auth events em Supabase Auth Logs (fora do DB)
--   cross_tenant_access     → admin switch de cliente: evento implícito, não crítico
-- =============================================================================
