-- ═══════════════════════════════════════════════════════════════════════════════
-- GAP P1 — VALIDAÇÃO UNIFICADA DE DADOS MÍNIMOS
-- Regra canônica: foco só avança de 'suspeita' → 'em_triagem'/'aguarda_inspecao'
-- com localização + bairro/região + classificação + descrição + evidência.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Coluna dados_minimos_em em focos_risco ─────────────────────────────────
-- Registra quando o foco passou a ter dados mínimos completos pela 1ª vez.

ALTER TABLE focos_risco
  ADD COLUMN IF NOT EXISTS dados_minimos_em timestamptz;

COMMENT ON COLUMN focos_risco.dados_minimos_em IS
  'Timestamp da 1ª vez que o foco passou a ter dados mínimos completos. '
  'Preenchido automaticamente pelo trigger trg_dados_minimos_auto_registrar. '
  'Nunca editar manualmente.';

-- ── 2. Estender CHECK de tipo_evento em foco_risco_historico ──────────────────

DO $$
BEGIN
  ALTER TABLE foco_risco_historico
    DROP CONSTRAINT IF EXISTS foco_risco_historico_tipo_evento_check;

  ALTER TABLE foco_risco_historico
    ADD CONSTRAINT foco_risco_historico_tipo_evento_check
    CHECK (tipo_evento IN (
      'transicao_status',
      'classificacao_alterada',
      'dados_minimos_completos'
    ));
END;
$$;

-- ── 3. Função canônica fn_foco_tem_dados_minimos ──────────────────────────────
-- Retorna TRUE se o foco possui todos os dados mínimos obrigatórios.
-- Regra: localização AND (bairro/região) AND classificacao AND descricao AND evidencia.
-- Usada pela view v_focos_dados_minimos_status e pelo trigger de bloqueio.

CREATE OR REPLACE FUNCTION fn_foco_tem_dados_minimos(p_foco_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- Localização: endereço OU coordenadas OU imóvel cadastrado
    (fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    -- Bairro/setor: via imóvel (tem bairro) OU região cadastrada
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    -- Classificação: sempre presente (NOT NULL DEFAULT), mas garantimos
    AND (fr.classificacao_inicial IS NOT NULL)
    -- Descrição: observação não vazia
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    -- Evidência: origem drone/vistoria, casos vinculados, ou operação de campo
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id LIMIT 1)
    )
  FROM focos_risco fr
  WHERE fr.id = p_foco_id;
$$;

COMMENT ON FUNCTION fn_foco_tem_dados_minimos IS
  'Retorna TRUE se o foco possui dados mínimos: localização + bairro/região + '
  'classificação + descrição (observação) + evidência (origem drone/vistoria/caso/operação). '
  'SECURITY DEFINER + STABLE — seguro para uso em views e triggers.';

-- ── 4. View v_focos_dados_minimos_status ─────────────────────────────────────
-- Detalhamento por foco: qual critério falta. Usada pelo GestorFocoDetalhe.

CREATE OR REPLACE VIEW v_focos_dados_minimos_status
WITH (security_invoker = true)
AS
SELECT
  fr.id                  AS foco_id,
  fr.cliente_id,

  -- Localização: endereço normalizado OU coordenadas OU imóvel cadastrado
  (fr.endereco_normalizado IS NOT NULL
   OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
   OR fr.imovel_id IS NOT NULL)                                              AS tem_localizacao,

  -- Bairro: via imóvel (imoveis.bairro) ou região cadastrada
  (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)                     AS tem_bairro,

  -- Classificação: sempre preenchida (NOT NULL DEFAULT 'suspeito')
  (fr.classificacao_inicial IS NOT NULL)                                     AS tem_classificacao,

  -- Descrição: observação não nula e não vazia
  (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)            AS tem_descricao,

  -- Evidência: qualquer origem ou vínculo técnico
  (fr.origem_levantamento_item_id IS NOT NULL
   OR fr.origem_vistoria_id IS NOT NULL
   OR array_length(fr.casos_ids, 1) > 0
   OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id))      AS tem_evidencia,

  -- tem_dados_minimos: todos os critérios satisfeitos
  (
    (fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    AND (fr.classificacao_inicial IS NOT NULL)
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    )
  )                                                                          AS tem_dados_minimos,

  -- Pendências: array de strings com o que falta
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NOT (
      fr.endereco_normalizado IS NOT NULL
      OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
      OR fr.imovel_id IS NOT NULL
    ) THEN 'sem_localizacao' END,

    CASE WHEN NOT (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
      THEN 'sem_bairro' END,

    CASE WHEN NOT (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
      THEN 'sem_descricao' END,

    CASE WHEN NOT (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    ) THEN 'sem_evidencia' END
  ], NULL)                                                                   AS pendencias,

  fr.dados_minimos_em

FROM focos_risco fr
WHERE fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_dados_minimos_status IS
  'Detalhamento de dados mínimos por foco: booleano por critério + array de pendências. '
  'Usada pelo GestorFocoDetalhe (painel "Dados Mínimos"). '
  'security_invoker = true — RLS de focos_risco aplicada automaticamente.';

-- ── 5. Recriar v_focos_risco_ativos com tem_dados_minimos + pendencias ────────

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
  END AS sla_status,
  -- Dados mínimos inline (evita JOIN extra)
  (
    (fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    AND (fr.classificacao_inicial IS NOT NULL)
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    )
  )                                                                          AS tem_dados_minimos,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NOT (
      fr.endereco_normalizado IS NOT NULL
      OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
      OR fr.imovel_id IS NOT NULL
    ) THEN 'sem_localizacao' END,
    CASE WHEN NOT (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
      THEN 'sem_bairro' END,
    CASE WHEN NOT (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
      THEN 'sem_descricao' END,
    CASE WHEN NOT (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    ) THEN 'sem_evidencia' END
  ], NULL)                                                                   AS pendencias
FROM focos_risco fr
LEFT JOIN imoveis          i   ON i.id  = fr.imovel_id
LEFT JOIN regioes          r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios         u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional  sla ON sla.foco_risco_id = fr.id
                               AND sla.status NOT IN ('concluido','vencido')
WHERE fr.status     NOT IN ('resolvido','descartado')
  AND fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo + dados mínimos (tem_dados_minimos, pendencias). '
  'security_invoker = true — RLS aplicada automaticamente.';

-- ── 6. Recriar v_focos_risco_todos com tem_dados_minimos + pendencias ─────────

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
  li.item      AS origem_item,
  (
    (fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    AND (fr.classificacao_inicial IS NOT NULL)
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    )
  )                                                                          AS tem_dados_minimos,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NOT (
      fr.endereco_normalizado IS NOT NULL
      OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
      OR fr.imovel_id IS NOT NULL
    ) THEN 'sem_localizacao' END,
    CASE WHEN NOT (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
      THEN 'sem_bairro' END,
    CASE WHEN NOT (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
      THEN 'sem_descricao' END,
    CASE WHEN NOT (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    ) THEN 'sem_evidencia' END
  ], NULL)                                                                   AS pendencias
FROM focos_risco fr
LEFT JOIN imoveis            i   ON i.id  = fr.imovel_id
LEFT JOIN regioes            r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios           u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional    sla ON sla.foco_risco_id = fr.id
                                 AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN levantamento_itens li  ON li.id = fr.origem_levantamento_item_id
WHERE fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_todos IS
  'Todos os focos (inclui terminais) + dados mínimos. '
  'security_invoker = true — RLS aplicada automaticamente.';

-- ── 7. Estender fn_validar_transicao_foco_risco com validação de dados mínimos ─
-- A função original bloqueia transições inválidas de estado.
-- Adicionamos: suspeita → em_triagem/aguarda_inspecao requer dados mínimos.

CREATE OR REPLACE FUNCTION fn_validar_transicao_foco_risco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_localizacao bool;
  v_tem_bairro      bool;
  v_tem_descricao   bool;
  v_tem_evidencia   bool;
  v_pendencias      text[] := '{}';
BEGIN
  -- ── Regras originais da state machine ────────────────────────────────────

  -- Estado terminal: descartado
  IF OLD.status = 'descartado' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Foco descartado é estado terminal. Crie um novo foco_risco se o problema reaparecer.',
      OLD.status, NEW.status;
  END IF;

  -- Resolvido não volta a em_tratamento
  IF OLD.status = 'resolvido' AND NEW.status = 'em_tratamento' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Foco resolvido não pode retornar a em_tratamento. Crie um novo foco_risco com foco_anterior_id preenchido.',
      OLD.status, NEW.status;
  END IF;

  -- Suspeita não pula etapas
  IF OLD.status = 'suspeita' AND NEW.status IN ('confirmado','em_tratamento','resolvido') THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Suspeita deve passar por em_triagem ou aguarda_inspecao antes de ser confirmada.',
      OLD.status, NEW.status;
  END IF;

  -- Confirmado não pode ser descartado
  IF OLD.status = 'confirmado' AND NEW.status = 'descartado' THEN
    RAISE EXCEPTION 'Transição inválida: % → %. Um foco confirmado não pode ser descartado. Marque como resolvido com desfecho explicativo.',
      OLD.status, NEW.status;
  END IF;

  -- ── GAP P1: dados mínimos obrigatórios para sair da suspeita ─────────────
  -- Aplica-se a: suspeita → em_triagem  e  suspeita → aguarda_inspecao
  -- Não aplica-se a: suspeita → descartado (descartar não exige dados completos)

  IF OLD.status = 'suspeita' AND NEW.status IN ('em_triagem', 'aguarda_inspecao') THEN

    v_tem_localizacao := (
      NEW.endereco_normalizado IS NOT NULL
      OR (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL)
      OR NEW.imovel_id IS NOT NULL
    );

    v_tem_bairro := (NEW.imovel_id IS NOT NULL OR NEW.regiao_id IS NOT NULL);

    v_tem_descricao := (
      NEW.observacao IS NOT NULL AND length(trim(NEW.observacao)) > 0
    );

    v_tem_evidencia := (
      NEW.origem_levantamento_item_id IS NOT NULL
      OR NEW.origem_vistoria_id IS NOT NULL
      OR array_length(NEW.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = NEW.id LIMIT 1)
    );

    IF NOT v_tem_localizacao THEN
      v_pendencias := array_append(v_pendencias, 'sem_localizacao');
    END IF;
    IF NOT v_tem_bairro THEN
      v_pendencias := array_append(v_pendencias, 'sem_bairro');
    END IF;
    IF NOT v_tem_descricao THEN
      v_pendencias := array_append(v_pendencias, 'sem_descricao');
    END IF;
    IF NOT v_tem_evidencia THEN
      v_pendencias := array_append(v_pendencias, 'sem_evidencia');
    END IF;

    IF array_length(v_pendencias, 1) > 0 THEN
      RAISE EXCEPTION 'Foco não possui dados mínimos para triagem. Pendências: [%]',
        array_to_string(v_pendencias, ', ');
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ── 8. Trigger AFTER UPDATE: registrar evento dados_minimos_completos ─────────
-- Quando dados_minimos_em passa de NULL → preenchido, registra no histórico.

CREATE OR REPLACE FUNCTION fn_dados_minimos_auto_registrar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  -- Guard: se dados_minimos_em já estava preenchido, não faz nada (evita recursão)
  IF NEW.dados_minimos_em IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Verifica se agora tem dados mínimos
  IF NOT fn_foco_tem_dados_minimos(NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Resolve usuário logado
  SELECT id INTO v_usuario_id FROM usuarios WHERE auth_id = auth.uid();

  -- Marca o timestamp
  UPDATE focos_risco
     SET dados_minimos_em = now()
   WHERE id = NEW.id
     AND dados_minimos_em IS NULL;

  -- Registra no histórico (tipo_evento especial — sem mudança de status)
  INSERT INTO foco_risco_historico (
    foco_risco_id, cliente_id, status_anterior, status_novo,
    tipo_evento, motivo, alterado_por
  ) VALUES (
    NEW.id, NEW.cliente_id, NEW.status, NULL,
    'dados_minimos_completos',
    'Foco passou a ter dados mínimos completos',
    v_usuario_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dados_minimos_auto_registrar
  AFTER UPDATE ON focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_dados_minimos_auto_registrar();

COMMENT ON TRIGGER trg_dados_minimos_auto_registrar ON focos_risco IS
  'Detecta quando o foco passa a ter dados mínimos completos (1ª vez). '
  'Preenche dados_minimos_em e registra evento no foco_risco_historico.';

-- ── 9. Índice para relatórios futuros ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_focos_risco_dados_minimos
  ON focos_risco (cliente_id, dados_minimos_em)
  WHERE dados_minimos_em IS NOT NULL;
