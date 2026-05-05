-- =============================================================================
-- DIAGNÓSTICO: Dados antigos afetados pelo bug do fluxo sem-acesso
-- =============================================================================
-- Contexto:
--   Antes do PR-SEM-ACESSO-05, AgenteVistoria.tsx e AgenteFormularioVistoria.tsx
--   não passavam focoRiscoId para VistoriaSemAcesso. Resultado: a vistoria era
--   salva mas o foco permanecia em em_inspecao, sem ter sido transitado para
--   aguardando_nova_tentativa.
--
-- Este arquivo contém APENAS consultas SELECT — diagnóstico sem alterar dados.
-- Para executar: psql -f diagnostico-sem-acesso-antigo.sql
-- =============================================================================
-- RESTRIÇÕES: NÃO executar UPDATE, DELETE ou INSERT com base neste script.
--             Aguardar validação manual antes de qualquer correção.
-- =============================================================================


-- ─── SUMÁRIO EXECUTIVO ────────────────────────────────────────────────────────
-- Retorna contagem de cada categoria de problema para visão rápida.

SELECT
  'Q0a: vistorias_sem_acesso_sem_foco_risco_id'         AS categoria,
  COUNT(*)::int                                          AS total
FROM vistorias
WHERE acesso_realizado = false
  AND motivo_sem_acesso IS NOT NULL
  AND foco_risco_id IS NULL
  AND deleted_at IS NULL

UNION ALL

SELECT
  'Q0b: focos_em_inspecao_com_tentativas_acumuladas'    AS categoria,
  COUNT(*)::int
FROM focos_risco
WHERE status = 'em_inspecao'
  AND tentativas_sem_acesso > 0
  AND deleted_at IS NULL

UNION ALL

SELECT
  'Q0c: focos_em_inspecao_com_historico_sem_acesso'     AS categoria,
  COUNT(DISTINCT f.id)::int
FROM focos_risco f
JOIN foco_risco_historico h ON h.foco_risco_id = f.id
WHERE f.status = 'em_inspecao'
  AND h.tipo_evento IN ('sem_acesso_registrado', 'escalado_supervisor')
  AND f.deleted_at IS NULL

UNION ALL

SELECT
  'Q0d: focos_pendente_supervisor_status_invalido'      AS categoria,
  COUNT(*)::int
FROM focos_risco
WHERE pendente_decisao_supervisor = true
  AND status NOT IN ('aguardando_nova_tentativa', 'resolvido', 'descartado')
  AND deleted_at IS NULL

ORDER BY categoria;


-- ─── Q1: VISTORIAS SEM ACESSO SEM VÍNCULO COM FOCO ───────────────────────────
-- O que encontra:
--   Vistorias registradas como "sem acesso" (acesso_realizado=false + motivo
--   preenchido) onde foco_risco_id é NULL. São candidatas a serem vinculadas
--   a um foco em_inspecao do mesmo imóvel na mesma janela de tempo.
--
-- Risco de falso positivo:
--   Vistorias de rotina (sem foco atribuído) também podem ter acesso_realizado=false.
--   Verificar se imovel_id tem foco em_inspecao no período.

SELECT
  v.id                    AS vistoria_id,
  v.cliente_id,
  v.imovel_id,
  v.agente_id,
  v.data_visita,
  v.created_at            AS vistoria_criada_em,
  v.motivo_sem_acesso,
  v.observacao_acesso,
  v.foto_externa_url      IS NOT NULL AS tem_foto_evidencia,
  v.tentativa_numero
FROM vistorias v
WHERE v.acesso_realizado = false
  AND v.motivo_sem_acesso IS NOT NULL
  AND v.foco_risco_id IS NULL
  AND v.deleted_at IS NULL
ORDER BY v.data_visita DESC;


-- ─── Q2: FOCOS PRESOS EM em_inspecao COM tentativas_sem_acesso > 0 ────────────
-- O que encontra:
--   Focos cujo contador de tentativas foi incrementado (pela lógica do backend)
--   mas que nunca foram transitados de em_inspecao para aguardando_nova_tentativa.
--   Isto indica que o endpoint foi chamado mas a transição de status falhou
--   ou o focoRiscoId não foi passado em chamadas anteriores.
--
-- Risco de falso positivo:
--   Baixo — tentativas_sem_acesso > 0 com status em_inspecao é estado incoerente
--   pelo design atual do sistema.

SELECT
  f.id                         AS foco_id,
  f.cliente_id,
  f.codigo_foco,
  f.imovel_id,
  f.responsavel_id,
  f.status,
  f.tentativas_sem_acesso,
  f.pendente_decisao_supervisor,
  f.inspecao_em,
  f.created_at
FROM focos_risco f
WHERE f.status = 'em_inspecao'
  AND f.tentativas_sem_acesso > 0
  AND f.deleted_at IS NULL
ORDER BY f.tentativas_sem_acesso DESC, f.inspecao_em;


-- ─── Q3: FOCOS EM em_inspecao COM HISTÓRICO DE EVENTO sem_acesso ─────────────
-- O que encontra:
--   Focos onde o histórico registra evento 'sem_acesso_registrado' ou
--   'escalado_supervisor' mas o status atual ainda é em_inspecao. Estes são os
--   casos mais seguros de confirmar como bug — houve tentativa de transição mas
--   o status não foi atualizado.
--
-- Risco de falso positivo:
--   Muito baixo — se o histórico tem esse tipo_evento, a lógica de transição
--   foi alcançada mas o UPDATE do status falhou.

SELECT
  f.id                         AS foco_id,
  f.cliente_id,
  f.codigo_foco,
  f.imovel_id,
  f.status                     AS status_atual,
  f.tentativas_sem_acesso,
  f.pendente_decisao_supervisor,
  h.id                         AS historico_id,
  h.tipo_evento,
  h.motivo                     AS historico_motivo,
  h.alterado_por               AS alterado_por_usuario_id,
  h.alterado_em
FROM focos_risco f
JOIN foco_risco_historico h ON h.foco_risco_id = f.id
WHERE f.status = 'em_inspecao'
  AND h.tipo_evento IN ('sem_acesso_registrado', 'escalado_supervisor')
  AND f.deleted_at IS NULL
ORDER BY h.alterado_em DESC;


-- ─── Q4: FOCOS COM pendente_decisao_supervisor=true EM STATUS INVÁLIDO ────────
-- O que encontra:
--   Focos marcados como "aguardando decisão do supervisor" mas cujo status
--   não é aguardando_nova_tentativa. Pode indicar transição parcial ou
--   atualização direta do campo sem atualizar o status.
--
-- Status válido para pendente_decisao_supervisor=true: aguardando_nova_tentativa.
-- Terminais (resolvido/descartado) são ignorados — podem ter ficado com a flag
-- como legado antes de encerrar.

SELECT
  f.id                         AS foco_id,
  f.cliente_id,
  f.codigo_foco,
  f.imovel_id,
  f.status,
  f.tentativas_sem_acesso,
  f.pendente_decisao_supervisor,
  f.updated_at
FROM focos_risco f
WHERE f.pendente_decisao_supervisor = true
  AND f.status NOT IN ('aguardando_nova_tentativa', 'resolvido', 'descartado')
  AND f.deleted_at IS NULL
ORDER BY f.updated_at DESC;


-- ─── Q5: CORRELAÇÃO — CANDIDATOS A VÍNCULO (TODOS) ───────────────────────────
-- O que encontra:
--   Para cada vistoria sem foco_risco_id, tenta encontrar focos em em_inspecao
--   no mesmo imóvel dentro de uma janela de ±24h antes até +7 dias após
--   inspecao_em. Retorna 1 linha por par (vistoria × foco candidato), com a
--   coluna qtd_focos_candidatos indicando quantos focos são candidatos para
--   aquela vistoria.
--
-- Critério de segurança:
--   qtd_focos_candidatos = 1 → match único → candidato para correção automática
--   qtd_focos_candidatos > 1 → ambíguo → exige revisão manual

SELECT
  v.id                          AS vistoria_id,
  v.cliente_id,
  v.imovel_id,
  v.agente_id,
  v.data_visita,
  v.motivo_sem_acesso,
  v.tentativa_numero            AS tentativa_numero_vistoria,
  f.id                          AS foco_candidato_id,
  f.codigo_foco,
  f.status                      AS foco_status,
  f.responsavel_id              AS foco_responsavel_id,
  f.inspecao_em                 AS foco_inspecao_em,
  ROUND(
    ABS(EXTRACT(EPOCH FROM (v.data_visita - f.inspecao_em))) / 3600.0
  , 1)                          AS diff_horas_inspecao_vistoria,
  COUNT(f.id) OVER (
    PARTITION BY v.id
  )::int                        AS qtd_focos_candidatos
FROM vistorias v
JOIN focos_risco f
  ON  f.imovel_id   = v.imovel_id
  AND f.cliente_id  = v.cliente_id
  AND f.status      = 'em_inspecao'
  AND f.deleted_at  IS NULL
WHERE v.acesso_realizado   = false
  AND v.motivo_sem_acesso  IS NOT NULL
  AND v.foco_risco_id      IS NULL
  AND v.deleted_at         IS NULL
  AND v.data_visita BETWEEN
        (f.inspecao_em - INTERVAL '24 hours')
    AND (f.inspecao_em + INTERVAL '7 days')
ORDER BY v.data_visita DESC, diff_horas_inspecao_vistoria;


-- ─── Q6: MATCH ÚNICO (SEGUROS PARA CORREÇÃO AUTOMÁTICA) ──────────────────────
-- O que encontra:
--   Subconjunto de Q5 onde existe apenas UM foco candidato para a vistoria.
--   Estes são os casos onde a correção automática futura pode ser feita com
--   segurança (ver proposta de script de correção abaixo).
--
-- Sugestão de correção:
--   1. UPDATE vistorias SET foco_risco_id = foco_candidato_id WHERE id = vistoria_id
--   2. UPDATE focos_risco SET
--        status = 'aguardando_nova_tentativa',
--        tentativas_sem_acesso = tentativas_sem_acesso + 1,
--        pendente_decisao_supervisor = CASE WHEN tentativas_sem_acesso + 1 >= 3 THEN true ELSE false END
--      WHERE id = foco_candidato_id
--   3. INSERT INTO foco_risco_historico (correcao administrativa) — ver proposta abaixo

WITH candidatos AS (
  SELECT
    v.id                          AS vistoria_id,
    v.cliente_id,
    v.imovel_id,
    v.agente_id,
    v.data_visita,
    v.motivo_sem_acesso,
    v.observacao_acesso,
    v.foto_externa_url            IS NOT NULL AS tem_foto,
    v.tentativa_numero            AS tentativa_numero_vistoria,
    f.id                          AS foco_candidato_id,
    f.codigo_foco,
    f.status                      AS foco_status,
    f.responsavel_id              AS foco_responsavel_id,
    f.tentativas_sem_acesso       AS foco_tentativas_atuais,
    f.inspecao_em                 AS foco_inspecao_em,
    ROUND(
      ABS(EXTRACT(EPOCH FROM (v.data_visita - f.inspecao_em))) / 3600.0
    , 1)                          AS diff_horas,
    COUNT(f.id) OVER (
      PARTITION BY v.id
    )::int                        AS qtd_candidatos
  FROM vistorias v
  JOIN focos_risco f
    ON  f.imovel_id   = v.imovel_id
    AND f.cliente_id  = v.cliente_id
    AND f.status      = 'em_inspecao'
    AND f.deleted_at  IS NULL
  WHERE v.acesso_realizado   = false
    AND v.motivo_sem_acesso  IS NOT NULL
    AND v.foco_risco_id      IS NULL
    AND v.deleted_at         IS NULL
    AND v.data_visita BETWEEN
          (f.inspecao_em - INTERVAL '24 hours')
      AND (f.inspecao_em + INTERVAL '7 days')
)
SELECT
  vistoria_id,
  cliente_id,
  imovel_id,
  agente_id,
  data_visita,
  motivo_sem_acesso,
  observacao_acesso,
  tem_foto,
  tentativa_numero_vistoria,
  foco_candidato_id,
  codigo_foco,
  foco_status,
  foco_responsavel_id,
  foco_tentativas_atuais,
  foco_inspecao_em,
  diff_horas,
  -- Sugestão do novo número de tentativas após correção
  (foco_tentativas_atuais + 1)                     AS tentativas_pos_correcao,
  -- Flag se deve escalar para supervisor
  ((foco_tentativas_atuais + 1) >= 3
    OR motivo_sem_acesso IN ('sem_previsao', 'calha_inacessivel', 'outro'))
                                                   AS vai_escalar_supervisor,
  'MATCH ÚNICO — elegível para correção automática' AS sugestao_acao
FROM candidatos
WHERE qtd_candidatos = 1
ORDER BY data_visita DESC;


-- ─── Q7: AMBÍGUOS (REVISÃO MANUAL OBRIGATÓRIA) ───────────────────────────────
-- O que encontra:
--   Casos onde a vistoria sem vínculo tem MAIS DE UM foco candidato no mesmo
--   imóvel. Não é seguro corrigir automaticamente — exige análise manual para
--   determinar qual foco era o alvo da visita.

WITH candidatos AS (
  SELECT
    v.id                          AS vistoria_id,
    v.cliente_id,
    v.imovel_id,
    v.agente_id,
    v.data_visita,
    v.motivo_sem_acesso,
    f.id                          AS foco_candidato_id,
    f.codigo_foco,
    f.status                      AS foco_status,
    f.inspecao_em                 AS foco_inspecao_em,
    COUNT(f.id) OVER (
      PARTITION BY v.id
    )::int                        AS qtd_candidatos
  FROM vistorias v
  JOIN focos_risco f
    ON  f.imovel_id   = v.imovel_id
    AND f.cliente_id  = v.cliente_id
    AND f.status      = 'em_inspecao'
    AND f.deleted_at  IS NULL
  WHERE v.acesso_realizado   = false
    AND v.motivo_sem_acesso  IS NOT NULL
    AND v.foco_risco_id      IS NULL
    AND v.deleted_at         IS NULL
    AND v.data_visita BETWEEN
          (f.inspecao_em - INTERVAL '24 hours')
      AND (f.inspecao_em + INTERVAL '7 days')
)
SELECT
  vistoria_id,
  cliente_id,
  imovel_id,
  agente_id,
  data_visita,
  motivo_sem_acesso,
  foco_candidato_id,
  codigo_foco,
  foco_status,
  foco_inspecao_em,
  qtd_candidatos,
  'AMBÍGUO — revisão manual obrigatória' AS sugestao_acao
FROM candidatos
WHERE qtd_candidatos > 1
ORDER BY vistoria_id, foco_inspecao_em;


-- ─── Q8: VISTORIAS SEM CORRESPONDÊNCIA (SEM FOCO CANDIDATO) ──────────────────
-- O que encontra:
--   Vistorias sem foco_risco_id e sem nenhum foco em_inspecao candidato no
--   mesmo imóvel. Podem ser vistorias legítimas (sem foco atribuído), ou focos
--   que já foram transitados para outro status antes do diagnóstico.
--   NÃO corrigir automaticamente.

SELECT
  v.id                    AS vistoria_id,
  v.cliente_id,
  v.imovel_id,
  v.agente_id,
  v.data_visita,
  v.motivo_sem_acesso,
  v.tentativa_numero,
  'SEM CANDIDATO — não corrigir automaticamente' AS sugestao_acao
FROM vistorias v
WHERE v.acesso_realizado   = false
  AND v.motivo_sem_acesso  IS NOT NULL
  AND v.foco_risco_id      IS NULL
  AND v.deleted_at         IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM focos_risco f
    WHERE f.imovel_id   = v.imovel_id
      AND f.cliente_id  = v.cliente_id
      AND f.status      = 'em_inspecao'
      AND f.deleted_at  IS NULL
      AND v.data_visita BETWEEN
            (f.inspecao_em - INTERVAL '24 hours')
        AND (f.inspecao_em + INTERVAL '7 days')
  )
ORDER BY v.data_visita DESC;


-- =============================================================================
-- PROPOSTA DE SCRIPT DE CORREÇÃO FUTURA (NÃO EXECUTAR)
-- =============================================================================
-- Após validação manual dos resultados acima, criar script separado com:
--
-- FASE 1 — Vincular vistoria ao foco (apenas matches únicos de Q6):
--
--   BEGIN;
--
--   UPDATE vistorias
--   SET    foco_risco_id = '<foco_candidato_id>'
--   WHERE  id = '<vistoria_id>'
--     AND  foco_risco_id IS NULL;   -- guard de idempotência
--
--   FASE 2 — Transicionar foco para aguardando_nova_tentativa:
--
--   UPDATE focos_risco
--   SET    status                    = 'aguardando_nova_tentativa',
--          tentativas_sem_acesso     = tentativas_sem_acesso + 1,
--          pendente_decisao_supervisor = CASE
--              WHEN tentativas_sem_acesso + 1 >= 3 THEN true
--              ELSE false
--            END,
--          updated_at                = now()
--   WHERE  id     = '<foco_candidato_id>'
--     AND  status = 'em_inspecao';  -- guard: só aplica se ainda estiver em_inspecao
--
--   FASE 3 — Registrar histórico de correção administrativa:
--
--   INSERT INTO foco_risco_historico
--     (foco_risco_id, cliente_id, status_anterior, status_novo,
--      tipo_evento, motivo, alterado_em)
--   VALUES
--     ('<foco_id>', '<cliente_id>', 'em_inspecao', 'aguardando_nova_tentativa',
--      'correcao_administrativa',
--      'Correção retroativa: vistoria sem_acesso não havia vinculado foco_risco_id (bug PR-SEM-ACESSO-05)',
--      now());
--
--   COMMIT;
--
-- CRITÉRIOS DE SEGURANÇA PARA EXECUÇÃO AUTOMÁTICA:
--   ✅ qtd_focos_candidatos = 1      (match único no imóvel + janela temporal)
--   ✅ foco.status = 'em_inspecao'   (guard no UPDATE — idempotente)
--   ✅ vistoria.foco_risco_id IS NULL (guard no UPDATE — idempotente)
--   ✅ Janela: data_visita entre inspecao_em - 24h e inspecao_em + 7 dias
--
-- EXIGE REVISÃO MANUAL:
--   ❌ qtd_focos_candidatos > 1      (múltiplos focos candidatos)
--   ❌ Sem foco candidato algum      (vistoria sem imóvel ou foco já transitado)
--   ❌ foco.responsavel_id != v.agente_id (agente diferente do responsável do foco)
--
-- RISCOS E VALIDAÇÕES NECESSÁRIAS:
--   ⚠ Verificar se inspecao_em está preenchido — focos sem esse campo não têm
--     janela temporal confiável para correlação.
--   ⚠ A janela de 7 dias pode capturar vistorias de retorno (não a original).
--     Preferir usar a vistoria com menor diff_horas ao foco se houver dúvida.
--   ⚠ motivo_sem_acesso no frontend ('recusa_entrada', 'cachorro_bravo', etc.)
--     pode diferir do valor no backend ('recusa', 'fechado'). Confirmar mapeamento
--     antes de usar como critério de filtragem.
--   ⚠ Executar em TRANSACTION com BEGIN/COMMIT — nunca em autocommit.
--   ⚠ Fazer pg_dump antes de qualquer correção em produção.
-- =============================================================================
