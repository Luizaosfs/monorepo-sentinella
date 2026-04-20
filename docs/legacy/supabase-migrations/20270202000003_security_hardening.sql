-- =============================================================================
-- 20270202000003 — Security Hardening: 5 vetores de ataque corrigidos
--
-- C-01 (P0): Trigger bloqueia UPDATE direto de focos_risco.responsavel_id
--            por papéis não-supervisor, impedindo bypass de rpc_atribuir_agente_foco
--
-- C-02 (P0): NULL guard em rpc_transicionar_foco_risco — usuário sem linha
--            em usuarios tinha v_papel = NULL, passando pelos dois guards silenciosamente
--            (NULL IN (...) = NULL = falsy; NULL != 'agente' = NULL = falsy)
--
-- C-03 (P0): Diagnóstico de usuarios.papel_app — RPCs dependem desta coluna
--            mas migration 20270202000001 afirma que foi removida. Verifica e avisa.
--
-- C-04 (P1): Rate limit global por município em denunciar_cidadao
--            O rate limit por IP (10/h) era bypassável via X-Forwarded-For spoofing.
--            Adicionado limite de 50/h por município, independente de IP.
--
-- C-05 (P1): Verificação de usuario.ativo em rpc_transicionar_foco_risco
--            Usuário desativado com JWT válido (≤1h de staleness) continuava
--            executando transições de campo.
-- =============================================================================


-- ── C-01: Trigger — bloqueia UPDATE direto de responsavel_id por não-supervisores ──
-- Agentes NÃO podem reatribuir focos diretamente via api.focos.update().
-- rpc_atribuir_agente_foco (SECURITY DEFINER) continua funcionando porque
-- auth.uid() do supervisor passa em is_supervisor() mesmo dentro do DEFINER.
-- rpc_transicionar_foco_risco usa COALESCE(p_responsavel_id, responsavel_id):
-- quando p_responsavel_id=NULL, NEW.responsavel_id = OLD.responsavel_id →
-- IS DISTINCT FROM = FALSE → trigger não dispara para agentes. ✓

CREATE OR REPLACE FUNCTION public.fn_guard_focos_responsavel_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    IF NOT (public.is_supervisor() OR public.is_admin()) THEN
      RAISE EXCEPTION
        'Apenas supervisores podem redistribuir focos. Use rpc_atribuir_agente_foco.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_guard_focos_responsavel_update() IS
  'Guard de trigger: bloqueia alteração direta de responsavel_id por não-supervisores. '
  'Corrige vetor de ataque onde agente chamava api.focos.update({responsavel_id}) '
  'sem passar pelo rpc_atribuir_agente_foco.';

DROP TRIGGER IF EXISTS trg_guard_responsavel_update ON public.focos_risco;
CREATE TRIGGER trg_guard_responsavel_update
  BEFORE UPDATE OF responsavel_id ON public.focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_focos_responsavel_update();


-- ── C-02 + C-05: rpc_transicionar_foco_risco com NULL guard e ativo check ──
-- BUGS CORRIGIDOS:
--   - v_papel NULL passava pelos guards IF v_papel IN (...) e IF v_papel != 'agente'
--     pois NULL comparado a qualquer valor resulta em NULL (falsy) em SQL
--   - Usuário com ativo=false e JWT stale conseguia executar transições por ≤1h

CREATE OR REPLACE FUNCTION public.rpc_transicionar_foco_risco(
  p_foco_id        uuid,
  p_status_novo    text,
  p_motivo         text DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco   focos_risco;
  v_papel  text;
  v_ativo  boolean;
BEGIN
  -- Obter papel e status ativo do chamador
  -- usuarios.papel_app foi removida; papel canônico vem de papeis_usuarios.papel
  SELECT pu.papel, u.ativo
  INTO   v_papel, v_ativo
  FROM   usuarios u
  LEFT JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
  WHERE  u.auth_id = auth.uid();

  -- C-02: NULL guard — usuário sem linha em usuarios
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário sem papel definido — acesso negado'
      USING ERRCODE = 'P0001';
  END IF;

  -- C-05: ativo check — JWT pode ficar válido por até 1h após desativação
  IF NOT COALESCE(v_ativo, false) THEN
    RAISE EXCEPTION 'Usuário inativo — acesso negado'
      USING ERRCODE = 'P0001';
  END IF;

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id;
  END IF;

  -- Validar acesso de tenant
  IF NOT usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco %', p_foco_id;
  END IF;

  -- Admin e supervisor NÃO executam transições de campo
  IF v_papel IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION
      'Papel % não executa transições de campo. Supervisores usam rpc_atribuir_agente_foco.',
      v_papel
      USING ERRCODE = 'P0001';
  END IF;

  -- Apenas agentes executam transições operacionais
  IF v_papel != 'agente' THEN
    RAISE EXCEPTION 'Papel % não autorizado a transicionar focos',
      v_papel USING ERRCODE = 'P0001';
  END IF;

  IF v_foco.status NOT IN ('aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento') THEN
    RAISE EXCEPTION
      'Agente só pode transicionar focos em estados operacionais. '
      'Estado atual: %. Aguarde distribuição do supervisor.',
      v_foco.status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE focos_risco
     SET status         = p_status_novo,
         desfecho       = COALESCE(p_motivo, desfecho),
         responsavel_id = COALESCE(p_responsavel_id, responsavel_id)
   WHERE id = p_foco_id
  RETURNING * INTO v_foco;

  RETURN jsonb_build_object(
    'id',            v_foco.id,
    'status',        v_foco.status,
    'confirmado_em', v_foco.confirmado_em,
    'resolvido_em',  v_foco.resolvido_em,
    'updated_at',    v_foco.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_transicionar_foco_risco(uuid, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_transicionar_foco_risco IS
  'Transiciona o estado de um foco_risco. Exclusivo para agentes ativos. '
  'Admin e supervisor NÃO têm acesso. '
  'Guards: NULL papel (C-02), ativo=false (C-05), papel != agente, estado operacional.';


-- ── C-03: Diagnóstico — verificar se usuarios.papel_app existe ──────────────
-- Migration 20270202000001 afirma que a coluna foi removida em 20261015000002,
-- mas rpc_transicionar e rpc_atribuir_agente_foco dependem dela.
-- Se não existir, os RPCs falham silenciosamente ou em runtime.

DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'usuarios'
      AND column_name  = 'papel_app'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'C-03 OK: usuarios.papel_app EXISTS — RPCs de autorização funcionais.';
  ELSE
    RAISE WARNING
      'C-03 CRÍTICO: usuarios.papel_app NÃO EXISTE! '
      'RPCs rpc_transicionar_foco_risco e rpc_atribuir_agente_foco falharão em runtime. '
      'Recrie a coluna ou migre os RPCs para usar papeis_usuarios.papel.';
  END IF;
END;
$$;


-- ── C-04: Rate limit global por município em denunciar_cidadao ──────────────
-- Adiciona segundo limite: 50 denúncias/hora por município (independente de IP).
-- Usa ip_hash='__global__' como sentinel na tabela canal_cidadao_rate_limit.
-- O limite por IP (10/h) permanece; o global é a camada anti-spoofing.

CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug        text,
  p_bairro_id   uuid,
  p_descricao   text,
  p_latitude    double precision DEFAULT NULL,
  p_longitude   double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id   uuid;
  v_lev_id       uuid;
  v_item_id      uuid;
  v_ip_raw       text;
  v_ip_hash      text;
  v_contagem     int;
  v_janela       timestamptz;
  c_limite_ip    CONSTANT int := 10;   -- por IP por hora
  c_limite_slug  CONSTANT int := 50;   -- por município por hora (anti-spoofing)
BEGIN
  -- ── Rate limit por IP ──────────────────────────────────────────────────────
  BEGIN
    v_ip_raw := split_part(
      (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := 'unknown';
  END;

  v_ip_hash := md5(COALESCE(nullif(trim(v_ip_raw), ''), 'unknown'));
  v_janela  := date_trunc('hour', now());

  SELECT id INTO v_cliente_id FROM clientes WHERE slug = p_slug AND ativo = true;
  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Rate limit por IP
  INSERT INTO canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
  VALUES (v_ip_hash, v_cliente_id, v_janela, 1)
  ON CONFLICT (ip_hash, cliente_id, janela_hora)
  DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
  RETURNING contagem INTO v_contagem;

  IF v_contagem > c_limite_ip THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Muitas denúncias em pouco tempo. Tente novamente mais tarde.'
    );
  END IF;

  -- ── C-04: Rate limit global por município (anti X-Forwarded-For spoofing) ──
  INSERT INTO canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
  VALUES ('__global__', v_cliente_id, v_janela, 1)
  ON CONFLICT (ip_hash, cliente_id, janela_hora)
  DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
  RETURNING contagem INTO v_contagem;

  IF v_contagem > c_limite_slug THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Limite de denúncias por hora atingido para este município.'
    );
  END IF;

  -- ── Busca ou cria levantamento do canal cidadão ────────────────────────────
  SELECT id INTO v_lev_id
  FROM levantamentos
  WHERE cliente_id = v_cliente_id AND tipo_entrada = 'MANUAL'
    AND titulo = 'Canal Cidadão'
  LIMIT 1;

  IF v_lev_id IS NULL THEN
    INSERT INTO levantamentos (cliente_id, usuario_id, titulo, data_voo, total_itens, tipo_entrada)
    SELECT v_cliente_id, u.id, 'Canal Cidadão', CURRENT_DATE, 0, 'MANUAL'
    FROM usuarios u WHERE u.cliente_id = v_cliente_id LIMIT 1
    RETURNING id INTO v_lev_id;
  END IF;

  IF v_lev_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não foi possível criar levantamento');
  END IF;

  INSERT INTO levantamento_itens (
    levantamento_id, item, risco, prioridade,
    latitude, longitude,
    endereco_curto,
    payload
  ) VALUES (
    v_lev_id, 'Denúncia Cidadão', 'Médio', 'Média',
    p_latitude, p_longitude,
    p_descricao,
    jsonb_build_object(
      'fonte',              'cidadao',
      'bairro_id',          p_bairro_id::text,
      'descricao_original', p_descricao
    )
  )
  RETURNING id INTO v_item_id;

  UPDATE levantamentos SET total_itens = total_itens + 1 WHERE id = v_lev_id;

  RETURN jsonb_build_object('ok', true, 'item_id', v_item_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision)
  TO anon, authenticated;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision) IS
  'Canal do cidadão: cria denúncia de foco suspeito. Acessível sem autenticação. '
  'Rate limit: 10/hora por IP + 50/hora por município (anti X-Forwarded-For spoofing). '
  'Corrige vetor C-04: atacante não consegue mais criar >50 focos/h via IP rotation.';
