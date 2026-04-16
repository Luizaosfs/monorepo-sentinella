-- ═══════════════════════════════════════════════════════════════════════════════
-- P0.1 — Supervisor sem descarte
--
-- Regra oficial consolidada:
--   Supervisor PODE:  atribuir, reatribuir, classificar, organizar, acompanhar
--   Supervisor NÃO PODE: descartar, confirmar, iniciar inspeção,
--                        iniciar tratamento, resolver
--
-- Corrige P0 que ainda permitia supervisor descartar em em_triagem.
-- Após esta migration, supervisores só podem chamar rpc_atribuir_agente_foco.
-- ═══════════════════════════════════════════════════════════════════════════════

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

  -- Supervisores não executam transições operacionais.
  -- A única ação do supervisor é rpc_atribuir_agente_foco.
  IF v_papel IN ('admin', 'gestor') THEN
    RAISE EXCEPTION
      'Supervisores não executam transições de campo. '
      'Use rpc_atribuir_agente_foco para distribuição. '
      'Estado atual: %, tentativa: %',
      v_foco.status, p_status_novo
      USING ERRCODE = 'P0001';
  END IF;

  -- Agentes operam apenas estados após triagem
  IF v_papel NOT IN ('operador', 'agente') THEN
    RAISE EXCEPTION 'Papel % não autorizado a transicionar focos',
      COALESCE(v_papel, 'desconhecido') USING ERRCODE = 'P0001';
  END IF;

  IF v_foco.status NOT IN ('aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento') THEN
    RAISE EXCEPTION
      'Agentes só podem transicionar focos em estados operacionais. '
      'Estado atual: %. Aguarde distribuição do gestor.',
      v_foco.status
      USING ERRCODE = 'P0001';
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

COMMENT ON FUNCTION rpc_transicionar_foco_risco IS
  'Transiciona o estado de um foco_risco. Exclusivo para agentes/operadores. '
  'Supervisores não têm acesso — usar rpc_atribuir_agente_foco para distribuição.';
