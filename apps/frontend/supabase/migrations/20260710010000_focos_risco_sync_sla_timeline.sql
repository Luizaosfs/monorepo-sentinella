-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 — Parte 2: sincronização bidirecional, SLA e timeline
-- • fn_sincronizar_status_atendimento  — foco → levantamento_item (1-way)
-- • fn_congelar_status_atendimento     — depreca updates diretos em levantamento_items
-- • fn_fechar_sla_ao_resolver_foco     — fecha SLA quando foco resolve/descarta
-- • fn_iniciar_sla_ao_confirmar_foco   — abre SLA quando foco é confirmado
-- • BACKFILL                           — sincroniza dados existentes
-- • v_foco_risco_timeline              — linha do tempo unificada
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. fn_sincronizar_status_atendimento ─────────────────────────────────────
-- Mapeamento unidirecional focos_risco.status → levantamento_itens.status_atendimento

CREATE OR REPLACE FUNCTION fn_sincronizar_status_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_status text;
BEGIN
  IF NEW.origem_levantamento_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapeamento canônico foco → item
  v_novo_status := CASE NEW.status
    WHEN 'suspeita'          THEN 'pendente'
    WHEN 'em_triagem'        THEN 'pendente'
    WHEN 'aguarda_inspecao'  THEN 'pendente'
    WHEN 'confirmado'        THEN 'pendente'
    WHEN 'em_tratamento'     THEN 'em_atendimento'
    WHEN 'resolvido'         THEN 'resolvido'
    WHEN 'descartado'        THEN 'resolvido'
    ELSE NULL
  END;

  IF v_novo_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sinaliza que a atualização é interna (desbloqueia fn_congelar_status_atendimento)
  PERFORM set_config('sentinella.trigger_interno', 'true', true);

  UPDATE levantamento_itens
     SET status_atendimento = v_novo_status::text,
         data_resolucao = CASE
           WHEN NEW.status = 'resolvido' THEN NEW.resolvido_em
           ELSE data_resolucao
         END
   WHERE id = NEW.origem_levantamento_item_id;

  PERFORM set_config('sentinella.trigger_interno', 'false', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sincronizar_status_atendimento
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        AND NEW.origem_levantamento_item_id IS NOT NULL)
  EXECUTE FUNCTION fn_sincronizar_status_atendimento();

-- ── 2. fn_congelar_status_atendimento ────────────────────────────────────────
-- Bloqueia updates diretos em levantamento_itens.status_atendimento.
-- Permite apenas atualizações vindas de triggers internos.

CREATE OR REPLACE FUNCTION fn_congelar_status_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite se veio de um trigger interno (ex: fn_sincronizar_status_atendimento)
  IF current_setting('sentinella.trigger_interno', true) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'status_atendimento está deprecated. '
    'Use focos_risco para gerenciar o ciclo operacional. '
    'Chame rpc_transicionar_foco_risco() no lugar.';
END;
$$;

CREATE TRIGGER trg_congelar_status_atendimento
  BEFORE UPDATE ON levantamento_itens
  FOR EACH ROW
  WHEN (OLD.status_atendimento IS DISTINCT FROM NEW.status_atendimento)
  EXECUTE FUNCTION fn_congelar_status_atendimento();

-- ── 3. fn_fechar_sla_ao_resolver_foco ────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_fechar_sla_ao_resolver_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sla_operacional
     SET status       = 'concluido',
         concluido_em = now()
   WHERE foco_risco_id = NEW.id
     AND status NOT IN ('concluido', 'vencido');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fechar_sla_ao_resolver_foco
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (NEW.status IN ('resolvido', 'descartado')
        AND OLD.status NOT IN ('resolvido', 'descartado'))
  EXECUTE FUNCTION fn_fechar_sla_ao_resolver_foco();

-- ── 4. fn_iniciar_sla_ao_confirmar_foco ──────────────────────────────────────
-- Se já existe sla_operacional vinculado ao item de origem, apenas vincula.
-- Se não existe, cria um novo usando a config do cliente (mesma lógica de
-- fn_gerar_sla_levantamento_item mas com inicio = confirmado_em).

CREATE OR REPLACE FUNCTION fn_iniciar_sla_ao_confirmar_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla_existente_id  uuid;
  v_config            record;
  v_prioridade        text;
  v_sla_horas         float8;
  v_prazo_final       timestamptz;
BEGIN
  -- 1. Se já existe SLA vinculado ao foco, não faz nada
  SELECT id INTO v_sla_existente_id
    FROM sla_operacional
   WHERE foco_risco_id = NEW.id
   LIMIT 1;

  IF v_sla_existente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Se existe SLA vinculado ao levantamento_item de origem, apenas vincula
  IF NEW.origem_levantamento_item_id IS NOT NULL THEN
    UPDATE sla_operacional
       SET foco_risco_id = NEW.id
     WHERE levantamento_item_id = NEW.origem_levantamento_item_id
       AND foco_risco_id IS NULL;

    -- Se atualizou algum, termina aqui
    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  -- 3. Cria novo SLA usando a config do cliente/região
  v_prioridade := COALESCE(NEW.prioridade, 'P3');

  -- Resolve config de SLA (tenta por região, depois cliente padrão)
  SELECT sc.* INTO v_config
    FROM sla_config sc
   WHERE sc.cliente_id = NEW.cliente_id
     AND (sc.regiao_id = NEW.regiao_id OR sc.regiao_id IS NULL)
   ORDER BY sc.regiao_id NULLS LAST
   LIMIT 1;

  -- Calcula horas baseado na prioridade
  v_sla_horas := CASE v_prioridade
    WHEN 'P1' THEN COALESCE((v_config.config->>'p1_horas')::float8, 4)
    WHEN 'P2' THEN COALESCE((v_config.config->>'p2_horas')::float8, 12)
    WHEN 'P3' THEN COALESCE((v_config.config->>'p3_horas')::float8, 24)
    WHEN 'P4' THEN COALESCE((v_config.config->>'p4_horas')::float8, 72)
    WHEN 'P5' THEN COALESCE((v_config.config->>'p5_horas')::float8, 168)
    ELSE 24
  END;

  v_prazo_final := COALESCE(NEW.confirmado_em, now()) + (v_sla_horas || ' hours')::interval;

  INSERT INTO sla_operacional (
    cliente_id,
    levantamento_item_id,
    foco_risco_id,
    prioridade,
    status,
    inicio,
    prazo_final,
    sla_horas
  ) VALUES (
    NEW.cliente_id,
    NEW.origem_levantamento_item_id,
    NEW.id,
    v_prioridade,
    'aberto',
    COALESCE(NEW.confirmado_em, now()),
    v_prazo_final,
    v_sla_horas
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_iniciar_sla_ao_confirmar_foco
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado' AND OLD.status <> 'confirmado')
  EXECUTE FUNCTION fn_iniciar_sla_ao_confirmar_foco();

-- ── 5. BACKFILL ───────────────────────────────────────────────────────────────

-- 5a. Sincronizar focos que nasceram de itens já resolvidos
UPDATE focos_risco fr
   SET status       = 'resolvido',
       resolvido_em = li.data_resolucao
  FROM levantamento_itens li
 WHERE fr.origem_levantamento_item_id = li.id
   AND li.status_atendimento = 'resolvido'
   AND li.data_resolucao IS NOT NULL
   AND fr.status NOT IN ('resolvido', 'descartado');

-- 5b. Focos de itens em_atendimento → em_tratamento
UPDATE focos_risco fr
   SET status = 'em_tratamento'
  FROM levantamento_itens li
 WHERE fr.origem_levantamento_item_id = li.id
   AND li.status_atendimento = 'em_atendimento'
   AND fr.status = 'suspeita';

-- 5c. Vincular SLAs existentes ao foco_risco via levantamento_item
UPDATE sla_operacional sla
   SET foco_risco_id = fr.id
  FROM focos_risco fr
 WHERE sla.levantamento_item_id = fr.origem_levantamento_item_id
   AND sla.foco_risco_id IS NULL;

-- ── 6. View v_foco_risco_timeline ────────────────────────────────────────────

CREATE OR REPLACE VIEW v_foco_risco_timeline
WITH (security_invoker = true)
AS
-- 1. Transições de estado (foco_risco_historico)
SELECT
  frh.foco_risco_id,
  'estado'                                            AS tipo,
  frh.alterado_em                                     AS ts,
  'Status: ' || COALESCE(frh.status_anterior, 'novo') || ' → ' || frh.status_novo AS titulo,
  frh.motivo                                          AS descricao,
  frh.alterado_por                                    AS ator_id,
  NULL::uuid                                          AS ref_id
FROM foco_risco_historico frh

UNION ALL

-- 2. Vistorias vinculadas (via origem_vistoria_id)
SELECT
  fr.id                                               AS foco_risco_id,
  'vistoria'                                          AS tipo,
  v.checkin_em                                        AS ts,
  'Vistoria: ' || v.tipo_atividade                    AS titulo,
  CASE
    WHEN v.acesso_realizado = false THEN 'Sem acesso — ' || COALESCE(v.motivo_sem_acesso, '')
    ELSE v.observacao
  END                                                 AS descricao,
  v.agente_id                                         AS ator_id,
  v.id                                                AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.id = fr.origem_vistoria_id

UNION ALL

-- 3. Vistorias no mesmo imóvel/ciclo (sem vínculo direto, detecção por proximidade)
SELECT
  fr.id                                               AS foco_risco_id,
  'vistoria_campo'                                    AS tipo,
  v.checkin_em                                        AS ts,
  'Vistoria de campo: ' || v.tipo_atividade           AS titulo,
  v.observacao                                        AS descricao,
  v.agente_id                                         AS ator_id,
  v.id                                                AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.imovel_id = fr.imovel_id
 AND v.ciclo     = fr.ciclo
 AND v.id       <> COALESCE(fr.origem_vistoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE fr.imovel_id IS NOT NULL
  AND fr.ciclo     IS NOT NULL

UNION ALL

-- 4. Mudanças de SLA (abertura / vencimento / conclusão)
SELECT
  fr.id                                               AS foco_risco_id,
  'sla'                                               AS tipo,
  COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio) AS ts,
  CASE sla.status
    WHEN 'aberto'   THEN 'SLA aberto — prazo: ' || to_char(sla.prazo_final, 'DD/MM/YYYY HH24:MI')
    WHEN 'vencido'  THEN 'SLA vencido'
    WHEN 'concluido' THEN 'SLA concluído'
    ELSE 'SLA: ' || sla.status
  END                                                 AS titulo,
  'Prioridade ' || sla.prioridade || ' — ' || sla.sla_horas::text || 'h' AS descricao,
  NULL::uuid                                          AS ator_id,
  sla.id                                              AS ref_id
FROM focos_risco fr
JOIN sla_operacional sla ON sla.foco_risco_id = fr.id

UNION ALL

-- 5. Casos notificados cruzados (via casos_ids array)
SELECT
  fr.id                                               AS foco_risco_id,
  'caso_notificado'                                   AS tipo,
  cn.data_notificacao::timestamptz                    AS ts,
  'Caso notificado: ' || cn.doenca                    AS titulo,
  'Status: ' || cn.status || ' — ' || COALESCE(cn.bairro, '')  AS descricao,
  cn.notificador_id                                   AS ator_id,
  cn.id                                               AS ref_id
FROM focos_risco fr
JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
WHERE array_length(fr.casos_ids, 1) > 0;

COMMENT ON VIEW v_foco_risco_timeline IS
  'Linha do tempo unificada de tudo que aconteceu em um foco: '
  'transições de estado, vistorias, SLA e casos notificados cruzados. '
  'Ordenar por ts DESC no cliente. security_invoker = true.';
