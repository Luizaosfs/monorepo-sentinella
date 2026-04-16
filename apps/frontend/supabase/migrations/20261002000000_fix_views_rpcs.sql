-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: C-01, C-02 — Views desatualizadas + auth.uid() como FK incorreto
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── C-01: Recriar views para incluir classificacao_inicial ───────────────────
--
-- PostgreSQL não permite CREATE OR REPLACE VIEW quando a lista de colunas muda
-- (fr.* expande com a nova coluna classificacao_inicial de focos_risco).
-- Solução: DROP + CREATE dentro de uma transação.
-- CASCADE descarta automaticamente objetos dependentes (grants, etc).
-- Também acrescentamos WHERE fr.deleted_at IS NULL em v_focos_risco_ativos
-- (estava faltando — v_focos_risco_todos já tinha).

DROP VIEW IF EXISTS v_focos_risco_ativos CASCADE;

CREATE VIEW v_focos_risco_ativos
WITH (security_invoker = true)
AS
SELECT
  fr.*,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.tipo_imovel,
  r.regiao    AS regiao_nome,
  u.nome      AS responsavel_nome,
  sla.prazo_final AS sla_prazo_em,
  sla.violado     AS sla_violado,
  CASE
    WHEN sla.prazo_final IS NULL                                                THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10       THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30       THEN 'atencao'
    ELSE 'ok'
  END AS sla_status
FROM focos_risco fr
LEFT JOIN imoveis          i   ON i.id  = fr.imovel_id
LEFT JOIN regioes          r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios         u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional  sla ON sla.foco_risco_id = fr.id
                               AND sla.status NOT IN ('concluido','vencido')
WHERE fr.status     NOT IN ('resolvido','descartado')
  AND fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo (exclui resolvido, descartado e soft-deleted). '
  'Inclui endereço do imóvel, nome da região, responsável e posição do SLA. '
  'Expõe classificacao_inicial após fix C-01 (migration 20261002000000). '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';

-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_focos_risco_todos CASCADE;

CREATE VIEW v_focos_risco_todos
WITH (security_invoker = true)
AS
SELECT
  fr.*,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.tipo_imovel,
  r.regiao    AS regiao_nome,
  u.nome      AS responsavel_nome,
  sla.prazo_final AS sla_prazo_em,
  sla.violado     AS sla_violado,
  CASE
    WHEN sla.prazo_final IS NULL                                                THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10       THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30       THEN 'atencao'
    ELSE 'ok'
  END AS sla_status,
  li.image_url AS origem_image_url,
  li.item      AS origem_item
FROM focos_risco fr
LEFT JOIN imoveis            i   ON i.id  = fr.imovel_id
LEFT JOIN regioes            r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios           u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional    sla ON sla.foco_risco_id = fr.id
                                 AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN levantamento_itens li  ON li.id = fr.origem_levantamento_item_id
WHERE fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_todos IS
  'Todos os focos (inclui resolvido e descartado, exclui soft-deleted). '
  'Mesmos JOINs de v_focos_risco_ativos + levantamento_itens para origem_image_url/item. '
  'Expõe classificacao_inicial após fix C-01 (migration 20261002000000). '
  'Usar apenas quando filtros explícitos de status terminal são necessários. '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';

-- ── C-02: Corrigir auth.uid() usado como FK de usuarios(id) ──────────────────
--
-- criado_por e cancelado_por em reinspecoes_programadas são REFERENCES usuarios(id),
-- mas as RPCs originais gravavam auth.uid() diretamente — que é o UUID de auth.users,
-- não de usuarios. Agora resolvemos via: SELECT id INTO v_usuario_id FROM usuarios
-- WHERE auth_id = auth.uid().

CREATE OR REPLACE FUNCTION rpc_criar_reinspecao_manual(
  p_foco_risco_id  uuid,
  p_tipo           reinspecao_tipo  DEFAULT 'eficacia_pos_tratamento',
  p_data_prevista  timestamptz      DEFAULT (now() + interval '7 days'),
  p_responsavel_id uuid             DEFAULT NULL,
  p_observacao     text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f           focos_risco%ROWTYPE;
  v_id          uuid;
  v_usuario_id  uuid;
BEGIN
  SELECT * INTO v_f FROM focos_risco WHERE id = p_foco_risco_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Foco não encontrado');
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_f.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  IF v_f.status NOT IN ('confirmado', 'em_tratamento') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Reinspeção só pode ser criada para focos confirmados ou em tratamento');
  END IF;

  IF p_data_prevista < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Data prevista não pode ser no passado');
  END IF;

  -- C-02: Resolve auth.uid() → usuarios.id (FK correto para criado_por)
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = auth.uid();

  INSERT INTO reinspecoes_programadas (
    cliente_id, foco_risco_id, status, tipo, origem,
    data_prevista, responsavel_id, observacao, criado_por
  )
  VALUES (
    v_f.cliente_id, p_foco_risco_id, 'pendente', p_tipo, 'manual',
    p_data_prevista, p_responsavel_id, p_observacao, v_usuario_id
  )
  ON CONFLICT (foco_risco_id, tipo) WHERE (status = 'pendente')
  DO UPDATE SET
    data_prevista  = EXCLUDED.data_prevista,
    responsavel_id = EXCLUDED.responsavel_id,
    observacao     = COALESCE(EXCLUDED.observacao, reinspecoes_programadas.observacao),
    origem         = 'manual',
    updated_at     = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_criar_reinspecao_manual TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_cancelar_reinspecao(
  p_reinspecao_id       uuid,
  p_motivo_cancelamento text DEFAULT 'Cancelado manualmente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r           reinspecoes_programadas%ROWTYPE;
  v_usuario_id  uuid;
BEGIN
  SELECT * INTO v_r
  FROM   reinspecoes_programadas
  WHERE  id = p_reinspecao_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reinspeção não encontrada');
  END IF;

  IF NOT public.usuario_pode_acessar_cliente(v_r.cliente_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  IF v_r.status NOT IN ('pendente', 'vencida') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Só é possível cancelar reinspeções pendentes ou vencidas');
  END IF;

  -- C-02: Resolve auth.uid() → usuarios.id (FK correto para cancelado_por)
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = auth.uid();

  UPDATE reinspecoes_programadas
  SET
    status              = 'cancelada',
    motivo_cancelamento = p_motivo_cancelamento,
    cancelado_por       = v_usuario_id,
    updated_at          = now()
  WHERE id = p_reinspecao_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_cancelar_reinspecao TO authenticated;
