-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 — Aggregate Root: focos_risco
-- Implementa a entidade central do ciclo operacional de riscos territoriais.
-- Inclui: tabelas, RLS, índices, triggers (state machine + histórico +
-- criação automática de itens/vistoria), imutabilidade de levantamento_item,
-- vínculo de SLA, view v_focos_risco_ativos e RPC de transição.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela principal ───────────────────────────────────────────────────────

CREATE TABLE focos_risco (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                  uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  imovel_id                   uuid        REFERENCES imoveis(id) ON DELETE SET NULL,
  regiao_id                   uuid        REFERENCES regioes(id) ON DELETE SET NULL,
  origem_tipo                 text        NOT NULL
    CHECK (origem_tipo IN ('drone','agente','cidadao','pluvio','manual')),
  origem_levantamento_item_id uuid        REFERENCES levantamento_itens(id) ON DELETE SET NULL,
  origem_vistoria_id          uuid        REFERENCES vistorias(id) ON DELETE SET NULL,
  status                      text        NOT NULL DEFAULT 'suspeita'
    CHECK (status IN (
      'suspeita','em_triagem','aguarda_inspecao',
      'confirmado','em_tratamento','resolvido','descartado'
    )),
  prioridade                  text        CHECK (prioridade IN ('P1','P2','P3','P4','P5')),
  ciclo                       integer     CHECK (ciclo BETWEEN 1 AND 6),
  latitude                    float8,
  longitude                   float8,
  endereco_normalizado        text,
  suspeita_em                 timestamptz NOT NULL DEFAULT now(),
  confirmado_em               timestamptz,
  resolvido_em                timestamptz,
  responsavel_id              uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  desfecho                    text,
  foco_anterior_id            uuid        REFERENCES focos_risco(id) ON DELETE SET NULL,
  casos_ids                   uuid[]      NOT NULL DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE focos_risco IS
  'Aggregate Root do evento de risco territorial. '
  'State machine com 7 estados. Nasce na suspeita, termina em resolvido/descartado. '
  'SLA inicia em confirmado_em. Recorrência = novo foco com foco_anterior_id preenchido.';

COMMENT ON COLUMN focos_risco.endereco_normalizado IS
  'Único campo texto de endereço nesta tabela. '
  'Derivado de imoveis.logradouro quando imovel_id existir. '
  'Nunca duplicar endereço de outras tabelas aqui.';

COMMENT ON COLUMN focos_risco.casos_ids IS
  'Array de caso_notificado.id próximos a este foco (raio 300m). '
  'Mantido pelo trigger de cruzamento — não editar manualmente.';

COMMENT ON COLUMN focos_risco.foco_anterior_id IS
  'Preenchido quando este foco representa recorrência no mesmo imóvel. '
  'Descartados/resolvidos são terminais — novo foco_risco é criado, não reabrimos.';

-- ── 2. Tabela de histórico (append-only ledger) ───────────────────────────────

CREATE TABLE foco_risco_historico (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  foco_risco_id   uuid        NOT NULL REFERENCES focos_risco(id) ON DELETE CASCADE,
  cliente_id      uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo     text        NOT NULL,
  alterado_por    uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo          text,
  alterado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE foco_risco_historico IS
  'Ledger append-only de transições de estado de focos_risco. '
  'NUNCA UPDATE. NUNCA DELETE. Inserção apenas via trigger fn_registrar_historico_foco.';

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE focos_risco        ENABLE ROW LEVEL SECURITY;
ALTER TABLE foco_risco_historico ENABLE ROW LEVEL SECURITY;

-- focos_risco: SELECT / INSERT / UPDATE para membros do cliente; DELETE bloqueado
CREATE POLICY "focos_risco_select" ON focos_risco
  FOR SELECT USING (usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "focos_risco_insert" ON focos_risco
  FOR INSERT WITH CHECK (usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "focos_risco_update" ON focos_risco
  FOR UPDATE USING (usuario_pode_acessar_cliente(cliente_id));

-- foco_risco_historico: SELECT / INSERT; UPDATE e DELETE bloqueados
CREATE POLICY "foco_risco_historico_select" ON foco_risco_historico
  FOR SELECT USING (usuario_pode_acessar_cliente(cliente_id));

CREATE POLICY "foco_risco_historico_insert" ON foco_risco_historico
  FOR INSERT WITH CHECK (usuario_pode_acessar_cliente(cliente_id));

-- ── 4. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX idx_focos_risco_cliente            ON focos_risco (cliente_id);
CREATE INDEX idx_focos_risco_status             ON focos_risco (status);
CREATE INDEX idx_focos_risco_cliente_status     ON focos_risco (cliente_id, status);
CREATE INDEX idx_focos_risco_imovel             ON focos_risco (imovel_id)
  WHERE imovel_id IS NOT NULL;
CREATE INDEX idx_focos_risco_cliente_suspeita   ON focos_risco (cliente_id, suspeita_em DESC);
CREATE INDEX idx_focos_risco_anterior           ON focos_risco (foco_anterior_id)
  WHERE foco_anterior_id IS NOT NULL;
CREATE INDEX idx_focos_risco_casos_ids          ON focos_risco USING GIN (casos_ids);
CREATE INDEX idx_focos_risco_geo                ON focos_risco
  USING GIST (geography(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX idx_foco_historico_foco_id         ON foco_risco_historico (foco_risco_id);
CREATE INDEX idx_foco_historico_cliente_dt      ON foco_risco_historico (cliente_id, alterado_em DESC);

-- ── 5. Trigger: updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_focos_risco_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_focos_risco_updated_at
  BEFORE UPDATE ON focos_risco
  FOR EACH ROW EXECUTE FUNCTION fn_focos_risco_updated_at();

-- ── 6. Trigger: validação de transição de estado (state machine) ──────────────

CREATE OR REPLACE FUNCTION fn_validar_transicao_foco_risco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nenhuma transição a partir de 'descartado' (estado terminal)
  IF OLD.status = 'descartado' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Foco descartado é estado terminal. Crie um novo foco_risco se o problema reaparecer.',
      OLD.status, NEW.status;
  END IF;

  -- Nenhuma transição a partir de 'resolvido' para em_tratamento
  IF OLD.status = 'resolvido' AND NEW.status = 'em_tratamento' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Foco resolvido não pode retornar a em_tratamento. Crie um novo foco_risco com foco_anterior_id preenchido.',
      OLD.status, NEW.status;
  END IF;

  -- suspeita não pode pular direto para confirmado, em_tratamento ou resolvido
  IF OLD.status = 'suspeita' AND NEW.status IN ('confirmado','em_tratamento','resolvido') THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Suspeita deve passar por em_triagem ou aguarda_inspecao antes de ser confirmada.',
      OLD.status, NEW.status;
  END IF;

  -- foco confirmado não pode ser descartado
  IF OLD.status = 'confirmado' AND NEW.status = 'descartado' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Um foco confirmado não pode ser descartado. Marque como resolvido com desfecho explicativo.',
      OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_transicao_foco_risco
  BEFORE UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_validar_transicao_foco_risco();

-- ── 7. Trigger: registrar histórico + carimbos automáticos ───────────────────

CREATE OR REPLACE FUNCTION fn_registrar_historico_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ledger append-only
  INSERT INTO foco_risco_historico (
    foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por
  ) VALUES (
    NEW.id, NEW.cliente_id, OLD.status, NEW.status, NEW.responsavel_id
  );

  -- Carimbo de confirmação
  IF NEW.status = 'confirmado' AND OLD.confirmado_em IS NULL THEN
    UPDATE focos_risco SET confirmado_em = now() WHERE id = NEW.id;
  END IF;

  -- Carimbo de resolução
  IF NEW.status = 'resolvido' AND OLD.resolvido_em IS NULL THEN
    UPDATE focos_risco SET resolvido_em = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registrar_historico_foco
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_registrar_historico_foco();

-- ── 8. Trigger: criar foco a partir de levantamento_item ─────────────────────

CREATE OR REPLACE FUNCTION fn_criar_foco_de_levantamento_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_imovel_id   uuid;
  v_origem_tipo text;
  v_lev         record;
BEGIN
  -- Busca cliente_id e tipo_entrada do levantamento
  SELECT l.cliente_id, l.tipo_entrada
    INTO v_lev
    FROM levantamentos l
   WHERE l.id = NEW.levantamento_id;

  IF v_lev.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_cliente_id := v_lev.cliente_id;

  -- Só cria foco para prioridades P1/P2/P3 ou risco alto/crítico
  IF NEW.prioridade NOT IN ('P1','P2','P3')
     AND lower(coalesce(NEW.risco,'')) NOT IN ('alto','crítico','critico')
  THEN
    RETURN NEW;
  END IF;

  -- Tenta vincular ao imóvel mais próximo (raio 30m)
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    SELECT i.id INTO v_imovel_id
      FROM imoveis i
     WHERE i.cliente_id = v_cliente_id
       AND ST_DWithin(
             ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
             ST_MakePoint(i.longitude,  i.latitude)::geography,
             30
           )
     ORDER BY ST_Distance(
               ST_MakePoint(NEW.longitude, NEW.latitude)::geography,
               ST_MakePoint(i.longitude,  i.latitude)::geography
              )
     LIMIT 1;
  END IF;

  v_origem_tipo := CASE
    WHEN upper(coalesce(v_lev.tipo_entrada,'')) = 'DRONE' THEN 'drone'
    ELSE 'agente'
  END;

  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    origem_tipo,
    origem_levantamento_item_id,
    prioridade,
    latitude,
    longitude,
    endereco_normalizado,
    suspeita_em
  ) VALUES (
    v_cliente_id,
    v_imovel_id,
    v_origem_tipo,
    NEW.id,
    NEW.prioridade,
    NEW.latitude,
    NEW.longitude,
    NEW.endereco_curto,
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_criar_foco_de_levantamento_item
  AFTER INSERT ON levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION fn_criar_foco_de_levantamento_item();

-- ── 9. Trigger: criar foco (já confirmado) a partir de vistoria_deposito ──────

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

  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    regiao_id,
    origem_tipo,
    origem_vistoria_id,
    status,
    confirmado_em,
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
    'confirmado',
    now(),
    v_vis.ciclo,
    v_imo.latitude,
    v_imo.longitude,
    v_imo.endereco
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_criar_foco_de_vistoria_deposito
  AFTER INSERT ON vistoria_depositos
  FOR EACH ROW
  WHEN (NEW.qtd_com_focos > 0)
  EXECUTE FUNCTION fn_criar_foco_de_vistoria_deposito();

-- ── 10. Trigger: imutabilidade de campos técnicos do levantamento_item ─────────

CREATE OR REPLACE FUNCTION fn_bloquear_update_campos_tecnicos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.arquivo              IS DISTINCT FROM NEW.arquivo              THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo arquivo não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.latitude             IS DISTINCT FROM NEW.latitude             THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo latitude não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.longitude            IS DISTINCT FROM NEW.longitude            THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo longitude não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.image_url            IS DISTINCT FROM NEW.image_url            THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo image_url não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.score_final          IS DISTINCT FROM NEW.score_final          THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo score_final não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.uuid_img             IS DISTINCT FROM NEW.uuid_img             THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo uuid_img não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.altitude_m           IS DISTINCT FROM NEW.altitude_m           THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo altitude_m não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.focal_mm             IS DISTINCT FROM NEW.focal_mm             THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo focal_mm não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.iso                  IS DISTINCT FROM NEW.iso                  THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo iso não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.exposure_s           IS DISTINCT FROM NEW.exposure_s           THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo exposure_s não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.detection_bbox       IS DISTINCT FROM NEW.detection_bbox       THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo detection_bbox não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.resolucao_largura_px IS DISTINCT FROM NEW.resolucao_largura_px THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo resolucao_largura_px não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.resolucao_altura_px  IS DISTINCT FROM NEW.resolucao_altura_px  THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo resolucao_altura_px não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  IF OLD.megapixels           IS DISTINCT FROM NEW.megapixels           THEN
    RAISE EXCEPTION 'levantamento_item é imutável após criação. Campo megapixels não pode ser alterado. Use focos_risco para rastreamento operacional.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloquear_update_campos_tecnicos
  BEFORE UPDATE ON levantamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION fn_bloquear_update_campos_tecnicos();

-- ── 11. Coluna foco_risco_id em sla_operacional ───────────────────────────────

ALTER TABLE sla_operacional
  ADD COLUMN IF NOT EXISTS foco_risco_id uuid REFERENCES focos_risco(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sla_foco_risco
  ON sla_operacional (foco_risco_id)
  WHERE foco_risco_id IS NOT NULL;

-- ── 12. Trigger: vincular SLA ao confirmar foco ───────────────────────────────

CREATE OR REPLACE FUNCTION fn_vincular_sla_ao_confirmar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmado'
     AND OLD.status <> 'confirmado'
     AND NEW.origem_levantamento_item_id IS NOT NULL
  THEN
    UPDATE sla_operacional
       SET foco_risco_id = NEW.id
     WHERE levantamento_item_id = NEW.origem_levantamento_item_id
       AND foco_risco_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vincular_sla_ao_confirmar
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado' AND OLD.status <> 'confirmado')
  EXECUTE FUNCTION fn_vincular_sla_ao_confirmar();

-- ── 13. View v_focos_risco_ativos ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_focos_risco_ativos
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
    WHEN sla.prazo_final IS NULL                                                       THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                       THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10              THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30              THEN 'atencao'
    ELSE 'ok'
  END AS sla_status
FROM focos_risco fr
LEFT JOIN imoveis   i   ON i.id  = fr.imovel_id
LEFT JOIN regioes   r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios  u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional sla
       ON sla.foco_risco_id = fr.id
      AND sla.status NOT IN ('concluido','vencido')
WHERE fr.status NOT IN ('resolvido','descartado');

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo (exclui resolvido e descartado). '
  'Inclui endereço do imóvel, nome da região, responsável e posição do SLA. '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';

-- ── 14. RPC rpc_transicionar_foco_risco ──────────────────────────────────────

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
  v_cliente_id uuid;
  v_foco       focos_risco;
BEGIN
  -- Valida acesso
  SELECT cliente_id INTO v_cliente_id FROM focos_risco WHERE id = p_foco_id;
  IF NOT usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco %', p_foco_id;
  END IF;

  -- Executa transição (trigger cuida da validação e do histórico)
  UPDATE focos_risco
     SET status          = p_status_novo,
         desfecho        = COALESCE(p_motivo, desfecho),
         responsavel_id  = COALESCE(p_responsavel_id, responsavel_id)
   WHERE id = p_foco_id
  RETURNING * INTO v_foco;

  RETURN jsonb_build_object(
    'id',           v_foco.id,
    'status',       v_foco.status,
    'confirmado_em',v_foco.confirmado_em,
    'resolvido_em', v_foco.resolvido_em,
    'updated_at',   v_foco.updated_at
  );
END;
$$;

COMMENT ON FUNCTION rpc_transicionar_foco_risco IS
  'Transiciona o estado de um foco_risco. '
  'Valida acesso do usuário via usuario_pode_acessar_cliente. '
  'O trigger fn_validar_transicao_foco_risco bloqueia transições inválidas com RAISE EXCEPTION.';

-- REPLICA IDENTITY para Realtime
ALTER TABLE focos_risco          REPLICA IDENTITY FULL;
ALTER TABLE foco_risco_historico REPLICA IDENTITY FULL;
