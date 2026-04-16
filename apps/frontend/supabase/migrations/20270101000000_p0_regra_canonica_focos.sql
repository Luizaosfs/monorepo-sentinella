-- ═══════════════════════════════════════════════════════════════════════════════
-- P0 — Fluxo canônico de focos_risco
--
-- 1. Restringe fn_validar_transicao_foco_risco() ao state machine estrito
-- 2. Cria trigger de auto-triagem (suspeita → em_triagem automático no INSERT)
-- 3. Cria rpc_atribuir_agente_foco() — distribuição exclusiva do gestor
-- 4. Adiciona validação de papel em rpc_transicionar_foco_risco()
-- 5. Corrige fn_criar_foco_de_vistoria_deposito() — cria como 'suspeita'
--
-- Fluxo canônico após esta migration:
--   suspeita ──(auto)──► em_triagem ──(gestor atribui)──► aguarda_inspecao
--   aguarda_inspecao ──(agente/auto)──► em_inspecao ──(agente)──► confirmado
--   confirmado ──(agente)──► em_tratamento ──(agente)──► resolvido / descartado
--   em_triagem ──(gestor descarta)──► descartado
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. State machine estrito ──────────────────────────────────────────────────
-- Transições removidas vs versão anterior:
--   suspeita → aguarda_inspecao (não pula mais)
--   suspeita → descartado       (não descarta antes da triagem)
--   em_triagem → confirmado     (não pula inspeção)
--   aguarda_inspecao → confirmado (não pula em_inspecao)
--   confirmado → resolvido      (obrigatório passar por em_tratamento)

CREATE OR REPLACE FUNCTION fn_validar_transicao_foco_risco()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'suspeita'         AND NEW.status = 'em_triagem') OR
    (OLD.status = 'em_triagem'       AND NEW.status IN ('aguarda_inspecao', 'descartado')) OR
    (OLD.status = 'aguarda_inspecao' AND NEW.status IN ('em_inspecao', 'descartado')) OR
    (OLD.status = 'em_inspecao'      AND NEW.status IN ('confirmado', 'descartado')) OR
    (OLD.status = 'confirmado'       AND NEW.status = 'em_tratamento') OR
    (OLD.status = 'em_tratamento'    AND NEW.status IN ('resolvido', 'descartado'))
  ) THEN
    RAISE EXCEPTION 'Transição inválida de foco_risco: % → %. Consulte o fluxo canônico.',
      OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Auto-triagem: suspeita → em_triagem imediatamente após INSERT ──────────

CREATE OR REPLACE FUNCTION fn_auto_triagem_foco()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Avança direto para em_triagem; o trigger fn_validar_transicao_foco_risco
  -- permite suspeita → em_triagem, portanto este UPDATE é sempre bem-sucedido.
  UPDATE public.focos_risco
  SET status     = 'em_triagem',
      updated_at = now()
  WHERE id = NEW.id
    AND status = 'suspeita';   -- guard: evita dupla execução em reinserts
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_triagem_foco ON public.focos_risco;
CREATE TRIGGER trg_auto_triagem_foco
  AFTER INSERT ON public.focos_risco
  FOR EACH ROW
  WHEN (NEW.status = 'suspeita')
  EXECUTE FUNCTION public.fn_auto_triagem_foco();

-- ── 3. RPC exclusiva de distribuição (gestor → agente) ───────────────────────
-- Transiciona em_triagem → aguarda_inspecao (com agente) OU
-- reatribui o responsável quando já em aguarda_inspecao.

CREATE OR REPLACE FUNCTION public.rpc_atribuir_agente_foco(
  p_foco_id   uuid,
  p_agente_id uuid,
  p_motivo    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario   usuarios%ROWTYPE;
  v_foco      focos_risco%ROWTYPE;
  v_novo_status text;
BEGIN
  -- Validar papel do chamador
  SELECT * INTO v_usuario FROM usuarios WHERE auth_id = auth.uid();
  IF NOT FOUND OR v_usuario.papel_app NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Apenas gestores e administradores podem distribuir focos para agentes'
      USING ERRCODE = 'P0001';
  END IF;

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id USING ERRCODE = 'P0002';
  END IF;

  -- Validar acesso de tenant
  IF NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco' USING ERRCODE = 'P0003';
  END IF;

  -- Só permite distribuição nos estados corretos
  IF v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao') THEN
    RAISE EXCEPTION 'Distribuição só é permitida nos estados em_triagem ou aguarda_inspecao. Estado atual: %',
      v_foco.status USING ERRCODE = 'P0001';
  END IF;

  v_novo_status := CASE v_foco.status
    WHEN 'em_triagem' THEN 'aguarda_inspecao'   -- avança o estado
    ELSE v_foco.status                           -- aguarda_inspecao: mantém, só troca responsável
  END;

  -- Atualiza foco (o trigger fn_validar_transicao_foco_risco valida a transição
  -- e fn_registrar_historico_foco registra o histórico automaticamente)
  UPDATE public.focos_risco
  SET responsavel_id = p_agente_id,
      status         = v_novo_status,
      updated_at     = now()
  WHERE id = p_foco_id;

  -- Para reatribuição (status não muda), registrar no histórico manualmente
  -- porque o trigger só dispara quando OLD.status IS DISTINCT FROM NEW.status
  IF v_foco.status = 'aguarda_inspecao' THEN
    INSERT INTO foco_risco_historico (
      foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      p_foco_id,
      v_foco.cliente_id,
      'aguarda_inspecao',
      'aguarda_inspecao',
      v_usuario.id,
      COALESCE(p_motivo, 'Reatribuição de agente')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atribuir_agente_foco(uuid, uuid, text) TO authenticated;

-- ── 4. Validação de papel em rpc_transicionar_foco_risco ─────────────────────
-- Gestores: apenas em_triagem → descartado.
-- Agentes: apenas estados operacionais (aguarda_inspecao em diante).

CREATE OR REPLACE FUNCTION rpc_transicionar_foco_risco(
  p_foco_id        uuid,
  p_status_novo    text,
  p_motivo         text    DEFAULT NULL,
  p_responsavel_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foco   focos_risco;
  v_papel  text;
BEGIN
  -- Obter papel do chamador
  SELECT papel_app INTO v_papel FROM usuarios WHERE auth_id = auth.uid();

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id;
  END IF;

  -- Validar acesso de tenant
  IF NOT usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco %', p_foco_id;
  END IF;

  -- Validar papel × transição
  IF v_papel IN ('admin', 'gestor') THEN
    -- Gestores só podem descartar em triagem; distribuição usa rpc_atribuir_agente_foco
    IF NOT (v_foco.status = 'em_triagem' AND p_status_novo = 'descartado') THEN
      RAISE EXCEPTION
        'Gestores só podem descartar focos em triagem. '
        'Para distribuir, use rpc_atribuir_agente_foco. '
        'Estado atual: %, tentativa: %', v_foco.status, p_status_novo
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_papel IN ('operador', 'agente') THEN
    -- Agentes operam apenas estados após triagem
    IF v_foco.status NOT IN ('aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento') THEN
      RAISE EXCEPTION
        'Agentes só podem transicionar focos em estados operacionais. '
        'Estado atual: %', v_foco.status
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Papel % não autorizado a transicionar focos',
      COALESCE(v_papel, 'desconhecido') USING ERRCODE = 'P0001';
  END IF;

  -- Executa transição (trigger valida state machine e registra histórico)
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

-- ── 5. Focos de vistoria nascem como suspeita (não mais confirmado) ────────────
-- O trigger trg_auto_triagem_foco avança para em_triagem logo após o INSERT.

CREATE OR REPLACE FUNCTION fn_criar_foco_de_vistoria_deposito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vis record;
  v_imo record;
BEGIN
  IF NEW.qtd_com_focos IS NULL OR NEW.qtd_com_focos = 0 THEN
    RETURN NEW;
  END IF;

  SELECT v.cliente_id, v.imovel_id, v.ciclo, v.agente_id
    INTO v_vis
    FROM vistorias v
   WHERE v.id = NEW.vistoria_id;

  IF v_vis.imovel_id IS NOT NULL THEN
    SELECT i.regiao_id, i.latitude, i.longitude,
           i.logradouro || ', ' || coalesce(i.numero,'S/N') AS endereco
      INTO v_imo
      FROM imoveis i
     WHERE i.id = v_vis.imovel_id;
  END IF;

  -- Cria como 'suspeita' — o trigger trg_auto_triagem_foco avança para em_triagem
  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    regiao_id,
    origem_tipo,
    origem_vistoria_id,
    status,
    ciclo,
    latitude,
    longitude,
    endereco_normalizado
  ) VALUES (
    v_vis.cliente_id,
    v_vis.imovel_id,
    v_imo.regiao_id,
    'agente',
    NEW.vistoria_id,
    'suspeita',        -- era 'confirmado'; agora entra no fluxo canônico
    v_vis.ciclo,
    v_imo.latitude,
    v_imo.longitude,
    v_imo.endereco
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION rpc_transicionar_foco_risco IS
  'Transiciona o estado de um foco_risco com validação de papel. '
  'Gestores: apenas em_triagem → descartado. '
  'Agentes: estados operacionais (aguarda_inspecao em diante). '
  'Distribuição (em_triagem → aguarda_inspecao) usa rpc_atribuir_agente_foco.';

COMMENT ON FUNCTION rpc_atribuir_agente_foco IS
  'Distribui um foco para um agente. '
  'em_triagem → aguarda_inspecao (primeira atribuição). '
  'aguarda_inspecao → aguarda_inspecao (reatribuição — só muda responsável). '
  'Exclusivo para gestores e administradores.';
