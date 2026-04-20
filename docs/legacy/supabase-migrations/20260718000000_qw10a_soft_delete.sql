-- QW-10A: Soft delete em tabelas críticas + proteção de DELETE em clientes
--
-- Problema: dados de saúde pública e operacionais são irreversíveis se deletados
--           sem backup funcional verificado e sem soft delete.
--
-- Correção 1 — Adicionar deleted_at / deleted_by às tabelas críticas
-- Correção 2 — Trigger bloqueia DELETE físico em clientes (força soft delete)
-- Correção 3 — Views operacionais filtram registros soft-deleted
--
-- Tabelas: focos_risco, casos_notificados, levantamento_itens, clientes
-- Views:   v_focos_risco_ativos, v_focos_com_casos,
--          v_focos_risco_analytics, v_foco_risco_timeline

-- ── Correção 1: Colunas de soft delete ───────────────────────────────────────

ALTER TABLE public.focos_risco
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.casos_notificados
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

COMMENT ON COLUMN public.focos_risco.deleted_at IS
  'Soft delete — timestamp de exclusão lógica. Registros não nulos ficam ocultos nas views operacionais. (QW-10A)';
COMMENT ON COLUMN public.focos_risco.deleted_by IS
  'UUID do usuário que executou o soft delete. (QW-10A)';

COMMENT ON COLUMN public.casos_notificados.deleted_at IS
  'Soft delete — dados de saúde pública mantidos para rastreabilidade epidemiológica (LGPD + Lei 6.259/1975). (QW-10A)';
COMMENT ON COLUMN public.casos_notificados.deleted_by IS
  'UUID do usuário que executou o soft delete. (QW-10A)';

COMMENT ON COLUMN public.levantamento_itens.deleted_at IS
  'Soft delete — evidências de campo mantidas para auditoria. (QW-10A)';
COMMENT ON COLUMN public.levantamento_itens.deleted_by IS
  'UUID do usuário que executou o soft delete. (QW-10A)';

COMMENT ON COLUMN public.clientes.deleted_at IS
  'Soft delete — DELETE físico bloqueado por trigger trg_bloquear_delete_cliente. '
  'Para desativar: UPDATE clientes SET ativo = false, deleted_at = now() WHERE id = <id>. (QW-10A)';

-- ── Índices parciais (só linhas com deleted_at preenchido — overhead zero em produção ativa) ──

CREATE INDEX IF NOT EXISTS idx_focos_risco_deleted_at
  ON public.focos_risco (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_casos_notificados_deleted_at
  ON public.casos_notificados (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_levantamento_itens_deleted_at
  ON public.levantamento_itens (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at
  ON public.clientes (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── Correção 2: Trigger — bloqueia DELETE físico em clientes ─────────────────

CREATE OR REPLACE FUNCTION fn_bloquear_delete_cliente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    '[QW-10A] DELETE fisico em clientes e bloqueado. '
    'Use: UPDATE clientes SET ativo = false, deleted_at = now() WHERE id = ''%''',
    OLD.id;
END;
$$;

COMMENT ON FUNCTION fn_bloquear_delete_cliente IS
  'Impede exclusão física de clientes. Toda desativação deve usar soft delete '
  '(ativo = false + deleted_at = now()). Protege contra deleção acidental em cascata. (QW-10A)';

DROP TRIGGER IF EXISTS trg_bloquear_delete_cliente ON public.clientes;
CREATE TRIGGER trg_bloquear_delete_cliente
  BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete_cliente();

-- ── Correção 3: Atualizar views para filtrar registros soft-deleted ───────────

-- 3a. v_focos_risco_ativos — adiciona AND fr.deleted_at IS NULL ao WHERE existente
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
    WHEN sla.prazo_final IS NULL                                             THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                             THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10   THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30   THEN 'atencao'
    ELSE 'ok'
  END AS sla_status
FROM focos_risco fr
LEFT JOIN imoveis         i   ON i.id  = fr.imovel_id
LEFT JOIN regioes         r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios        u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional sla
       ON sla.foco_risco_id = fr.id
      AND sla.status NOT IN ('concluido','vencido')
WHERE fr.status NOT IN ('resolvido','descartado')
  AND fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo (exclui resolvido, descartado e soft-deleted). '
  'Inclui endereço do imóvel, nome da região, responsável e posição do SLA. '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';

-- 3b. v_focos_com_casos — filtra focos e casos soft-deleted
DROP VIEW IF EXISTS v_focos_com_casos CASCADE;
CREATE VIEW v_focos_com_casos
WITH (security_invoker = true)
AS
SELECT
  fr.id                   AS foco_id,
  fr.cliente_id,
  fr.status               AS foco_status,
  fr.prioridade           AS foco_prioridade,
  fr.latitude             AS foco_lat,
  fr.longitude            AS foco_lng,
  fr.endereco_normalizado,
  fr.suspeita_em,
  fr.confirmado_em,
  cn.id                   AS caso_id,
  cn.status               AS caso_status,
  cn.doenca               AS caso_doenca,
  cn.data_notificacao,
  cn.bairro               AS caso_bairro,
  cfc.distancia_metros
FROM focos_risco fr
JOIN unnest(fr.casos_ids) AS cid(caso_uuid) ON true
JOIN casos_notificados cn  ON cn.id = cid.caso_uuid
LEFT JOIN caso_foco_cruzamento cfc
       ON cfc.caso_id              = cn.id
      AND cfc.levantamento_item_id = fr.origem_levantamento_item_id
WHERE array_length(fr.casos_ids, 1) > 0
  AND fr.deleted_at IS NULL
  AND cn.deleted_at IS NULL;

COMMENT ON VIEW v_focos_com_casos IS
  'Focos com pelo menos um caso notificado próximo (casos_ids não vazio). '
  'Exclui focos e casos com soft delete. '
  'security_invoker = true — RLS aplicada automaticamente.';

-- 3c. v_focos_risco_analytics — adiciona WHERE fr.deleted_at IS NULL e corrige subquery
DROP VIEW IF EXISTS v_focos_risco_analytics CASCADE;
CREATE VIEW v_focos_risco_analytics
WITH (security_invoker = true)
AS
SELECT
  fr.id,
  fr.cliente_id,
  fr.imovel_id,
  fr.regiao_id,
  r.regiao AS regiao_nome,
  fr.status,
  fr.prioridade,
  fr.origem_tipo,
  fr.ciclo,
  fr.latitude,
  fr.longitude,
  fr.endereco_normalizado,
  fr.suspeita_em,
  fr.confirmado_em,
  fr.resolvido_em,
  fr.foco_anterior_id,
  fr.casos_ids,
  CASE
    WHEN fr.resolvido_em IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (fr.resolvido_em - fr.suspeita_em)) / 3600.0, 2)
    ELSE NULL
  END AS tempo_total_horas,
  CASE
    WHEN fr.resolvido_em IS NOT NULL AND sla.prazo_final IS NOT NULL
      THEN fr.resolvido_em <= sla.prazo_final
    ELSE NULL
  END AS sla_cumprido,
  CASE
    WHEN fr.resolvido_em IS NOT NULL AND sla.inicio IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (fr.resolvido_em - sla.inicio)) / 3600.0, 2)
    ELSE NULL
  END AS sla_horas_utilizadas,
  sla.prazo_final AS sla_prazo_em,
  sla.violado     AS sla_violado,
  sla.prioridade  AS sla_prioridade,
  (fr.foco_anterior_id IS NOT NULL) AS eh_reincidencia,
  COALESCE((
    SELECT COUNT(*)
      FROM focos_risco fr2
     WHERE fr2.imovel_id  = fr.imovel_id
       AND fr2.cliente_id = fr.cliente_id
       AND fr2.id        <> fr.id
       AND fr2.deleted_at IS NULL
  ), 0) AS total_focos_no_imovel,
  array_length(fr.casos_ids, 1) AS total_casos_proximos,
  fr.created_at,
  fr.updated_at
FROM focos_risco fr
LEFT JOIN regioes r ON r.id = fr.regiao_id
LEFT JOIN sla_operacional sla
  ON sla.foco_risco_id = fr.id
 AND sla.status NOT IN ('concluido', 'vencido')
WHERE fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_analytics IS
  'View analitica de focos_risco com campos calculados: tempo_total_horas, sla_cumprido, '
  'sla_horas_utilizadas, eh_reincidencia, total_focos_no_imovel, total_casos_proximos. '
  'Exclui focos com soft delete. Filtrar por suspeita_em para recortes temporais. security_invoker = true.';

-- 3d. v_foco_risco_timeline — branches que referenciam focos_risco recebem deleted_at IS NULL
--     Branch 1 (historico de estado) preserva registro mesmo após soft delete — intencional para auditoria
DROP VIEW IF EXISTS v_foco_risco_timeline CASCADE;
CREATE VIEW v_foco_risco_timeline
WITH (security_invoker = true)
AS
-- 1. Transições de estado — preservadas mesmo após soft delete (trilha de auditoria)
SELECT
  frh.foco_risco_id,
  'estado'::text AS tipo,
  frh.alterado_em AS ts,
  'Status: ' || COALESCE(frh.status_anterior, 'novo') || ' -> ' || frh.status_novo AS titulo,
  frh.motivo AS descricao,
  frh.alterado_por AS ator_id,
  NULL::uuid AS ref_id
FROM foco_risco_historico frh

UNION ALL

-- 2. Detecção de origem (levantamento_item)
SELECT
  fr.id AS foco_risco_id,
  'deteccao'::text AS tipo,
  li.data_hora::timestamptz AS ts,
  'Deteccao: ' || COALESCE(li.item, '-')
    || ' (' || COALESCE(li.risco, '-')
    || ' - score ' || COALESCE(li.score_final::text, 'N/A') || ')' AS titulo,
  COALESCE(li.endereco_curto, li.endereco_completo) AS descricao,
  NULL::uuid AS ator_id,
  li.id AS ref_id
FROM focos_risco fr
JOIN levantamento_itens li ON li.id = fr.origem_levantamento_item_id
WHERE fr.deleted_at IS NULL

UNION ALL

-- 3. Vistorias vinculadas diretamente (origem_vistoria_id)
SELECT
  fr.id AS foco_risco_id,
  'vistoria'::text AS tipo,
  v.checkin_em AS ts,
  'Vistoria: ' || v.tipo_atividade AS titulo,
  CASE
    WHEN v.acesso_realizado = false
      THEN 'Sem acesso - ' || COALESCE(v.motivo_sem_acesso::text, '')
    ELSE COALESCE(v.observacao, 'Acesso realizado')
  END AS descricao,
  v.agente_id AS ator_id,
  v.id AS ref_id
FROM focos_risco fr
JOIN vistorias v ON v.id = fr.origem_vistoria_id
WHERE fr.deleted_at IS NULL

UNION ALL

-- 4. Vistorias no mesmo imovel/ciclo (sem vinculo direto)
SELECT
  fr.id AS foco_risco_id,
  'vistoria_campo'::text AS tipo,
  v.checkin_em AS ts,
  'Vistoria de campo: ' || v.tipo_atividade AS titulo,
  COALESCE(v.observacao, 'Vistoria registrada') AS descricao,
  v.agente_id AS ator_id,
  v.id AS ref_id
FROM focos_risco fr
JOIN vistorias v
  ON v.imovel_id = fr.imovel_id
 AND v.ciclo = fr.ciclo
 AND v.id <> COALESCE(fr.origem_vistoria_id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE fr.imovel_id  IS NOT NULL
  AND fr.ciclo      IS NOT NULL
  AND fr.deleted_at IS NULL

UNION ALL

-- 5. Acoes executadas (via operacoes.foco_risco_id — sem referência direta a focos_risco)
SELECT
  op.foco_risco_id AS foco_risco_id,
  'acao'::text AS tipo,
  op.iniciado_em AS ts,
  'Acao executada' AS titulo,
  COALESCE(op.observacao, 'Operacao registrada') AS descricao,
  op.responsavel_id AS ator_id,
  op.id AS ref_id
FROM operacoes op
WHERE op.foco_risco_id IS NOT NULL

UNION ALL

-- 6. Eventos de SLA
SELECT
  fr.id AS foco_risco_id,
  'sla'::text AS tipo,
  COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio) AS ts,
  CASE sla.status
    WHEN 'aberto'    THEN 'SLA aberto - prazo: ' || to_char(sla.prazo_final, 'DD/MM/YYYY HH24:MI')
    WHEN 'vencido'   THEN 'SLA vencido'
    WHEN 'concluido' THEN 'SLA concluido'
    ELSE 'SLA: ' || sla.status
  END AS titulo,
  'Prioridade ' || sla.prioridade || ' - ' || sla.sla_horas::text || 'h' AS descricao,
  NULL::uuid AS ator_id,
  sla.id AS ref_id
FROM focos_risco fr
JOIN sla_operacional sla ON sla.foco_risco_id = fr.id
WHERE fr.deleted_at IS NULL

UNION ALL

-- 7. Casos notificados cruzados
SELECT
  fr.id AS foco_risco_id,
  'caso_notificado'::text AS tipo,
  cn.data_notificacao::timestamptz AS ts,
  'Caso notificado: ' || cn.doenca AS titulo,
  'Status: ' || cn.status || ' - ' || COALESCE(cn.bairro, '') AS descricao,
  cn.notificador_id AS ator_id,
  cn.id AS ref_id
FROM focos_risco fr
JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
WHERE array_length(fr.casos_ids, 1) > 0
  AND fr.deleted_at IS NULL
  AND cn.deleted_at IS NULL;

COMMENT ON VIEW v_foco_risco_timeline IS
  'Linha do tempo unificada: deteccao, estado, vistoria, vistoria_campo, acao, sla, caso_notificado. '
  'Branches que referenciam focos_risco filtram deleted_at IS NULL. '
  'Branch 1 (historico de estado) preserva trilha de auditoria mesmo apos soft delete. '
  'Ordenar por ts DESC no cliente. security_invoker = true.';
