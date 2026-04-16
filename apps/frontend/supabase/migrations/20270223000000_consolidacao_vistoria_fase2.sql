-- =============================================================================
-- Migration: 20270220000000_consolidacao_vistoria_fase2.sql
-- Fase 2 V2 — fn_consolidar_vistoria(): função de consolidação automática
--
-- Especificação: V2 (aprovada) — Função V2 (corrige problemas críticos da V1)
-- Requer Fase 1 (20270219000000) aplicada anteriormente.
--
-- Alterações V2 (documentadas com -- [V2-N]):
--   [V2-1] Histórico: sempre arquiva quando há consolidação anterior
--   [V2-2] Flags sem peso: detectadas, incluídas no JSON, acionam incompleta
--   [V2-3] JSON: override_ativado, fallback_aplicado, dado_inconsistente
--   [V2-4] Pesos: ORDER BY created_at DESC (elimina risco lexicográfico de versão)
--   [V2-5] consolidacao_incompleta: expandida para dados faltantes em visitado
--   [V2-6] risco_vetorial='medio': documentado como comportamento conservador
--
-- Chamada manual para teste:
--   SELECT fn_consolidar_vistoria('<uuid>');
--   SELECT fn_consolidar_vistoria('<uuid>', 'Ajuste de limiares v1.0.1');
--
-- Ver resultado:
--   SELECT prioridade_final, consolidacao_resumo, consolidacao_json
--   FROM vistorias WHERE id = '<uuid>';
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_consolidar_vistoria(
  p_vistoria_id            uuid,
  p_motivo_reprocessamento text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ── Vistoria base ──────────────────────────────────────────────────────────
  v_vistoria              vistorias%ROWTYPE;

  -- ── Sub-tabelas (NULL quando não preenchidas) ──────────────────────────────
  v_sintomas              vistoria_sintomas%ROWTYPE;
  v_riscos                vistoria_riscos%ROWTYPE;

  v_tem_sintomas_record   boolean := false;
  v_tem_riscos_record     boolean := false;
  v_tem_depositos_record  boolean := false;

  -- ── Aggregates de depósitos ────────────────────────────────────────────────
  v_dep_focos_total       int     := 0;
  v_dep_inspecionados     int     := 0;

  -- ── Calhas ────────────────────────────────────────────────────────────────
  v_calha_com_foco        boolean := false;
  v_calha_com_agua        boolean := false;

  -- ── Pesos e limiares (carregados de consolidacao_pesos_config) ─────────────
  v_limiar_baixo_medio    numeric(5,2) := 2.0;   -- fallback hardcoded se config ausente
  v_limiar_medio_alto     numeric(5,2) := 5.0;
  v_versao_pesos          text         := 'fallback';

  -- ── Scores socioambientais ─────────────────────────────────────────────────
  v_score_social          numeric(8,2) := 0;
  v_score_sanitario       numeric(8,2) := 0;
  v_score_socioambiental  numeric(8,2) := 0;

  -- ── Array de flags ativas (social + sanitário) para score ─────────────────
  v_flags_ativas          text[] := '{}';

  -- [V2-2] Array de flags ativas sem peso configurado ────────────────────────
  v_flags_sem_peso        text[] := '{}';

  -- ── Sem acesso recorrente (contagem histórica do imóvel) ──────────────────
  v_sem_acesso_count      int    := 0;

  -- ── Proporção de sintomáticos ──────────────────────────────────────────────
  v_proporcao_sintomas    numeric(5,3) := 0;

  -- ── Dimensões calculadas ──────────────────────────────────────────────────
  v_resultado_op            text;
  v_vuln_domiciliar         text;
  v_alerta_saude            text;
  v_risco_socioambiental    text;
  v_risco_vetorial          text;
  v_prioridade_final        text;
  v_prioridade_motivo       text;
  v_dimensao_dominante      text;
  v_consolidacao_resumo     text;
  v_consolidacao_incompleta boolean := false;

  -- [V2-3] Campos de auditoria adicionais ────────────────────────────────────
  -- override_ativado: alerta_saude=urgente foi o fator determinante da prioridade
  -- fallback_aplicado: nenhuma dimensão atingiu limiar → prioridade por fallback
  -- dado_inconsistente: flag ativa sem peso cadastrado em consolidacao_pesos_config
  v_override_ativado      boolean := false;
  v_fallback_aplicado     boolean := false;
  v_dado_inconsistente    boolean := false;

  -- ── Snapshot JSON ─────────────────────────────────────────────────────────
  v_consolidacao_json     jsonb;

  -- ── Versão imutável da regra ───────────────────────────────────────────────
  VERSAO_REGRA CONSTANT text := '2.0.0';

BEGIN

  -- ────────────────────────────────────────────────────────────────────────────
  -- 1. CARREGAR VISTORIA
  -- ────────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_vistoria FROM vistorias WHERE id = p_vistoria_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_consolidar_vistoria: vistoria_id % não encontrada', p_vistoria_id;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 2. ARQUIVAR CONSOLIDAÇÃO ANTERIOR
  --
  -- [V2-1] MUDANÇA CRÍTICA: arquiva SEMPRE que consolidado_em IS NOT NULL,
  -- independente de p_motivo_reprocessamento.
  --
  -- Raciocínio da escolha (arquivar vs. bloquear):
  --   • Bloquear (RAISE EXCEPTION sem motivo) forçaria motivo explícito mas
  --     quebraria automação da Fase 3 (trigger pós-INSERT não passa motivo).
  --   • Arquivar sempre preserva o histórico em qualquer cenário, incluindo
  --     re-execução acidental.
  --   • p_motivo_reprocessamento continua sendo o rótulo auditável; quando
  --     ausente usamos um rótulo default para não perder rastreabilidade.
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_vistoria.consolidado_em IS NOT NULL THEN
    INSERT INTO vistoria_consolidacao_historico (
      vistoria_id,
      prioridade_final,
      dimensao_dominante,
      consolidacao_json,
      versao_regra,
      versao_pesos,
      consolidado_em,
      motivo_reprocessamento,
      reprocessado_por
    ) VALUES (
      p_vistoria_id,
      v_vistoria.prioridade_final,
      v_vistoria.dimensao_dominante,
      v_vistoria.consolidacao_json,
      v_vistoria.versao_regra_consolidacao,
      v_vistoria.versao_pesos_consolidacao,
      v_vistoria.consolidado_em,
      -- [V2-1] Fallback de motivo: nunca nulo no histórico
      COALESCE(p_motivo_reprocessamento, 'reprocessamento automático sem motivo explícito'),
      auth.uid()
    );
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 3. CARREGAR SUB-TABELAS
  -- ────────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_sintomas
  FROM vistoria_sintomas
  WHERE vistoria_id = p_vistoria_id
  LIMIT 1;
  v_tem_sintomas_record := FOUND;

  SELECT * INTO v_riscos
  FROM vistoria_riscos
  WHERE vistoria_id = p_vistoria_id
  LIMIT 1;
  v_tem_riscos_record := FOUND;

  SELECT
    COALESCE(SUM(qtd_com_focos), 0),
    COALESCE(SUM(qtd_inspecionados), 0)
  INTO v_dep_focos_total, v_dep_inspecionados
  FROM vistoria_depositos
  WHERE vistoria_id = p_vistoria_id;
  v_tem_depositos_record := (v_dep_inspecionados > 0);

  SELECT
    COALESCE(bool_or(com_foco), false),
    COALESCE(bool_or(condicao = 'com_agua_parada'), false)
  INTO v_calha_com_foco, v_calha_com_agua
  FROM vistoria_calhas
  WHERE vistoria_id = p_vistoria_id;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 4. SEM ACESSO RECORRENTE
  --    Conta TODAS as tentativas falhas do imóvel (incluindo esta vistoria).
  -- ────────────────────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_sem_acesso_count
  FROM vistorias
  WHERE imovel_id = v_vistoria.imovel_id
    AND acesso_realizado = false;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 5. CARREGAR PESOS E LIMIARES
  --    Prioridade: config do cliente > config global; mais recente primeiro.
  --
  --    [V2-4] ORDER BY agora usa created_at DESC em vez de versao DESC.
  --    Motivo: ordenação por string é lexicográfica — '1.9.0' > '1.10.0' seria
  --    uma comparação incorreta. created_at é monotônico e não tem esse risco.
  -- ────────────────────────────────────────────────────────────────────────────
  SELECT peso, versao
  INTO v_limiar_baixo_medio, v_versao_pesos
  FROM consolidacao_pesos_config
  WHERE flag_nome = 'limiar_baixo_medio'
    AND ativo = true
    AND (cliente_id = v_vistoria.cliente_id OR cliente_id IS NULL)
  ORDER BY (cliente_id = v_vistoria.cliente_id) DESC, created_at DESC  -- [V2-4]
  LIMIT 1;

  SELECT peso
  INTO v_limiar_medio_alto
  FROM consolidacao_pesos_config
  WHERE flag_nome = 'limiar_medio_alto'
    AND ativo = true
    AND (cliente_id = v_vistoria.cliente_id OR cliente_id IS NULL)
  ORDER BY (cliente_id = v_vistoria.cliente_id) DESC, created_at DESC  -- [V2-4]
  LIMIT 1;

  IF v_versao_pesos IS NULL THEN
    v_versao_pesos := 'fallback';
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 6. DIMENSÃO: resultado_operacional
  --    acesso_realizado=true (ou NULL legado) → 'visitado'
  --    acesso_realizado=false, 1ª tentativa   → 'sem_acesso'
  --    acesso_realizado=false, 2ª+ tentativa  → 'sem_acesso_retorno'
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_vistoria.acesso_realizado = true OR v_vistoria.acesso_realizado IS NULL THEN
    v_resultado_op := 'visitado';
  ELSIF v_sem_acesso_count >= 2 THEN
    v_resultado_op := 'sem_acesso_retorno';
  ELSE
    v_resultado_op := 'sem_acesso';
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 6b. COMPLETUDE DE DADOS (vistorias realizadas com fichas ausentes)
  --
  -- [V2-5] NOVO: consolidacao_incompleta = true também quando vistoria foi
  -- realizada mas faltam registros subsidiários.
  --
  -- Impacto no fallback (seção 11): se todas as dimensões ficarem baixo/nenhum
  -- E consolidacao_incompleta = true → prioridade_final = P3 (conservador).
  -- Isso eleva vistorias com fichas parciais de P5 para P3 — comportamento
  -- intencional para sinalizar qualidade de dados ao gestor.
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_resultado_op = 'visitado' THEN
    IF NOT v_tem_sintomas_record THEN
      -- [V2-5] Ausência de registro de sintomas em visita realizada
      v_consolidacao_incompleta := true;
    END IF;
    IF NOT v_tem_riscos_record THEN
      -- [V2-5] Ausência de registro de riscos em visita realizada
      v_consolidacao_incompleta := true;
    END IF;
    IF NOT v_tem_depositos_record THEN
      -- [V2-5] Ausência de depósitos inspecionados em visita realizada
      v_consolidacao_incompleta := true;
    END IF;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 7. DIMENSÃO: vulnerabilidade_domiciliar
  --    Hierarquia: critica > alta > media > baixa | inconclusivo (sem acesso)
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_resultado_op = 'visitado' THEN

    -- Crítica: pessoa incapacitada no domicílio (exige ação imediata de proteção)
    IF v_tem_riscos_record AND (v_riscos.menor_incapaz = true OR v_riscos.idoso_incapaz = true) THEN
      v_vuln_domiciliar := 'critica';

    -- Alta: população vulnerável + falta de suporte básico combinados
    ELSIF (v_vistoria.gravidas = true OR v_vistoria.idosos = true OR v_vistoria.criancas_7anos = true)
      AND v_tem_riscos_record
      AND (v_riscos.risco_moradia = true OR v_riscos.risco_alimentar = true OR v_riscos.dep_quimico = true)
    THEN
      v_vuln_domiciliar := 'alta';

    -- Média: qualquer vulnerável OU risco social isolado
    ELSIF v_vistoria.gravidas = true
       OR v_vistoria.idosos = true
       OR v_vistoria.criancas_7anos = true
       OR (v_tem_riscos_record AND (
             v_riscos.dep_quimico     = true
          OR v_riscos.risco_alimentar = true
          OR v_riscos.risco_moradia   = true
       ))
    THEN
      v_vuln_domiciliar := 'media';

    ELSE
      v_vuln_domiciliar := 'baixa';
    END IF;

  ELSE
    -- Sem acesso: nenhum dado coletado
    v_vuln_domiciliar := 'inconclusivo';
    v_consolidacao_incompleta := true;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 8. DIMENSÃO: alerta_saude
  --    Limiar de urgência: proporção de sintomáticos >= 50%
  --    'urgente' aciona override de prioridade (≥ P2) na seção 11.
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_resultado_op = 'visitado' THEN

    IF v_tem_sintomas_record THEN

      -- Calcular proporção de sintomáticos
      -- Proteção tripla: qtd > 0 AND moradores IS NOT NULL AND moradores > 0
      IF v_sintomas.moradores_sintomas_qtd > 0
        AND v_vistoria.moradores_qtd IS NOT NULL
        AND v_vistoria.moradores_qtd > 0
      THEN
        v_proporcao_sintomas :=
          v_sintomas.moradores_sintomas_qtd::numeric
          / v_vistoria.moradores_qtd::numeric;
      END IF;
      -- Nota: se moradores_qtd for NULL, v_proporcao_sintomas permanece 0,
      -- o que impede classificação 'urgente' por proporção — comportamento
      -- conservador intencional (sem denominador, sem urgência por proporção).

      IF v_sintomas.febre           = true
      OR v_sintomas.manchas_vermelhas = true
      OR v_sintomas.dor_articulacoes = true
      OR v_sintomas.dor_cabeca       = true
      THEN
        IF v_proporcao_sintomas >= 0.5 THEN
          v_alerta_saude := 'urgente';
        ELSE
          v_alerta_saude := 'atencao';
        END IF;
      ELSIF v_sintomas.moradores_sintomas_qtd > 0 THEN
        v_alerta_saude := 'atencao';
      ELSE
        v_alerta_saude := 'nenhum';
      END IF;

    ELSE
      -- Visitado sem registro de sintomas: ausência = nenhum
      -- (consolidacao_incompleta já foi marcada na seção 6b)
      v_alerta_saude := 'nenhum';
    END IF;

  ELSE
    v_alerta_saude := 'inconclusivo';
    v_consolidacao_incompleta := true;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 9. DIMENSÃO: risco_socioambiental
  --    Score ponderado via consolidacao_pesos_config (social + sanitário).
  --    DISTINCT ON garante um peso efetivo por flag_nome.
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_resultado_op = 'visitado' AND v_tem_riscos_record THEN

    -- Montar array de flags ativas (social)
    IF v_riscos.menor_incapaz   = true THEN v_flags_ativas := v_flags_ativas || 'menor_incapaz';   END IF;
    IF v_riscos.idoso_incapaz   = true THEN v_flags_ativas := v_flags_ativas || 'idoso_incapaz';   END IF;
    IF v_riscos.dep_quimico     = true THEN v_flags_ativas := v_flags_ativas || 'dep_quimico';     END IF;
    IF v_riscos.risco_alimentar = true THEN v_flags_ativas := v_flags_ativas || 'risco_alimentar'; END IF;
    IF v_riscos.risco_moradia   = true THEN v_flags_ativas := v_flags_ativas || 'risco_moradia';   END IF;

    -- Montar array de flags ativas (sanitário)
    IF v_riscos.criadouro_animais  = true THEN v_flags_ativas := v_flags_ativas || 'criadouro_animais';  END IF;
    IF v_riscos.lixo               = true THEN v_flags_ativas := v_flags_ativas || 'lixo';               END IF;
    IF v_riscos.residuos_organicos = true THEN v_flags_ativas := v_flags_ativas || 'residuos_organicos'; END IF;
    IF v_riscos.residuos_quimicos  = true THEN v_flags_ativas := v_flags_ativas || 'residuos_quimicos';  END IF;
    IF v_riscos.residuos_medicos   = true THEN v_flags_ativas := v_flags_ativas || 'residuos_medicos';   END IF;

    -- ── [V2-2] Detectar flags ativas sem peso configurado ─────────────────
    -- Uma flag ativa sem peso no banco gera score subavaliado silenciosamente.
    -- Aqui detectamos, marcamos consolidacao_incompleta e registramos no JSON.
    IF array_length(v_flags_ativas, 1) > 0 THEN
      SELECT COALESCE(array_agg(f ORDER BY f), '{}')
      INTO v_flags_sem_peso
      FROM unnest(v_flags_ativas) AS f
      WHERE NOT EXISTS (
        SELECT 1
        FROM consolidacao_pesos_config
        WHERE flag_nome = f
          AND ativo = true
          AND (cliente_id = v_vistoria.cliente_id OR cliente_id IS NULL)
      );

      IF array_length(v_flags_sem_peso, 1) > 0 THEN
        -- [V2-2] Flags sem peso: consolidação não é confiável
        v_consolidacao_incompleta := true;
        -- [V2-3] dado_inconsistente: sinaliza configuração defeituosa
        v_dado_inconsistente := true;
      END IF;
    END IF;

    -- ── Calcular score com pesos efetivos ─────────────────────────────────
    -- DISTINCT ON (flag_nome): garante um peso por flag.
    -- ORDER BY: cliente-específico > global; mais recente > mais antigo.
    -- [V2-4] created_at DESC substitui versao DESC (evita comparação lexicográfica).
    IF array_length(v_flags_ativas, 1) > 0 THEN
      WITH effective_weights AS (
        SELECT DISTINCT ON (flag_nome)
          flag_nome,
          grupo,
          peso
        FROM consolidacao_pesos_config
        WHERE ativo = true
          AND grupo IN ('social', 'sanitario')
          AND (cliente_id = v_vistoria.cliente_id OR cliente_id IS NULL)
          AND flag_nome = ANY(v_flags_ativas)
        ORDER BY flag_nome,
                 (cliente_id = v_vistoria.cliente_id) DESC,
                 created_at DESC                              -- [V2-4]
      )
      SELECT
        COALESCE(SUM(peso) FILTER (WHERE grupo = 'social'),    0),
        COALESCE(SUM(peso) FILTER (WHERE grupo = 'sanitario'), 0)
      INTO v_score_social, v_score_sanitario
      FROM effective_weights;
    END IF;

    v_score_socioambiental := v_score_social + v_score_sanitario;

    IF v_score_socioambiental >= v_limiar_medio_alto THEN
      v_risco_socioambiental := 'alto';
    ELSIF v_score_socioambiental >= v_limiar_baixo_medio THEN
      v_risco_socioambiental := 'medio';
    ELSE
      v_risco_socioambiental := 'baixo';
    END IF;

  ELSIF v_resultado_op = 'visitado' THEN
    -- Visitado sem registro de riscos: ausência = baixo
    -- (consolidacao_incompleta já foi marcada na seção 6b)
    v_risco_socioambiental := 'baixo';

  ELSE
    v_risco_socioambiental := 'inconclusivo';
    v_consolidacao_incompleta := true;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 10. DIMENSÃO: risco_vetorial
  --     Hierarquia: critico > alto > medio > baixo | inconclusivo (sem acesso)
  --
  --     critico : foco confirmado em depósito OU calha com com_foco=true
  --     alto    : flags vetoriais presentes OU calha com água parada (sem foco)
  --     medio   : depósitos foram inspecionados e todos negativos
  --     baixo   : visitado sem dados de campo vetorial
  --
  --     [V2-6] COMPORTAMENTO CONSERVADOR DOCUMENTADO:
  --     'medio' representa "depósitos inspecionados com resultado negativo",
  --     não apenas "foi ao local". Um imóvel com muitos depósitos inspecionados
  --     e todos negativos receberá risco_vetorial='medio' e pode ser classificado
  --     P4 mesmo sem risco real identificado. Isso é intencional: a inspeção
  --     ativa é considerada dado de campo relevante para monitoramento contínuo.
  --     Para indicar imóvel limpo e completamente monitorado, o caminho é P5
  --     (via fallback quando todas as dimensões estão baixo/nenhum).
  -- ────────────────────────────────────────────────────────────────────────────
  IF v_resultado_op = 'visitado' THEN

    -- critico: foco confirmado (qtd_com_focos > 0 em qualquer depósito) OU calha positiva
    IF v_dep_focos_total > 0 OR v_calha_com_foco THEN
      v_risco_vetorial := 'critico';

    -- alto: risco vetorial presente mas sem foco confirmado
    ELSIF (
            v_tem_riscos_record AND (
              v_riscos.acumulo_material_organico = true
           OR v_riscos.animais_sinais_lv         = true
           OR v_riscos.caixa_destampada          = true
           OR (v_riscos.outro_risco_vetorial IS NOT NULL
               AND length(trim(v_riscos.outro_risco_vetorial)) > 0)
            )
          )
          OR v_calha_com_agua
    THEN
      v_risco_vetorial := 'alto';

    -- [V2-6] medio: comportamento conservador — inspecionado e negativo
    ELSIF v_tem_depositos_record THEN
      v_risco_vetorial := 'medio';

    ELSE
      v_risco_vetorial := 'baixo';
    END IF;

  ELSE
    v_risco_vetorial := 'inconclusivo';
    v_consolidacao_incompleta := true;
  END IF;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 11. PRIORIDADE FINAL + EXPLICABILIDADE
  --
  --     Camada 1 — Sem acesso recorrente (sobrepõe matriz de dimensões)
  --       ≥ 5 tentativas → P2
  --       ≥ 3 tentativas → P3
  --       1–2 tentativas → P4
  --
  --     Camada 2 — Matriz de dimensões (visitado)
  --       P1: alerta_saude=urgente AND risco elevado em ≥1 outra dimensão
  --       P2: alerta_saude=urgente (isolado) OU (vetorial=critico AND vuln=critica)
  --       P3: vetorial critico/alto OU socioamb alto OU vuln critica/alta
  --       P4: vetorial medio OU socioamb medio OU vuln media OU alerta=atencao
  --       fallback: P3 (incompleto) | P5 (dados completos e negativos) | P4 (sem fichas)
  --
  --     [V2-3] v_override_ativado: true quando alerta_saude=urgente é o fator
  --     determinante da prioridade final (ramos P1 e P2-via-alerta).
  --     [V2-3] v_fallback_aplicado: true quando nenhuma dimensão atingiu limiar
  --     e a prioridade foi determinada pelo bloco de fallback.
  -- ────────────────────────────────────────────────────────────────────────────

  -- ── Camada 1: sem acesso ──────────────────────────────────────────────────
  IF v_resultado_op != 'visitado' THEN

    IF v_sem_acesso_count >= 5 THEN
      v_prioridade_final   := 'P2';
      v_prioridade_motivo  := format('Sem acesso recorrente: %s tentativas (≥5)', v_sem_acesso_count);
      v_dimensao_dominante := 'resultado_operacional';
    ELSIF v_sem_acesso_count >= 3 THEN
      v_prioridade_final   := 'P3';
      v_prioridade_motivo  := format('Sem acesso recorrente: %s tentativas (≥3)', v_sem_acesso_count);
      v_dimensao_dominante := 'resultado_operacional';
    ELSE
      v_prioridade_final   := 'P4';
      v_prioridade_motivo  := format('Sem acesso: %s tentativa(s) — dados insuficientes', v_sem_acesso_count);
      v_dimensao_dominante := 'resultado_operacional';
    END IF;

  ELSE
    -- ── Camada 2: matriz de dimensões ──────────────────────────────────────

    -- P1: alerta urgente + risco elevado em ao menos uma outra dimensão
    IF v_alerta_saude = 'urgente'
      AND (
           v_risco_vetorial IN ('critico','alto')
        OR v_vuln_domiciliar IN ('critica','alta')
        OR v_risco_socioambiental = 'alto'
      )
    THEN
      v_prioridade_final   := 'P1';
      v_prioridade_motivo  := 'Alerta de saúde urgente com risco elevado em outra dimensão';
      v_dimensao_dominante := 'alerta_saude';
      v_override_ativado   := true;  -- [V2-3]

    -- P2: alerta urgente isolado OU foco + vulnerabilidade crítica
    ELSIF v_alerta_saude = 'urgente'
       OR (v_risco_vetorial = 'critico' AND v_vuln_domiciliar = 'critica')
    THEN
      v_prioridade_final := 'P2';
      IF v_alerta_saude = 'urgente' THEN
        v_prioridade_motivo  := 'Alerta de saúde urgente (proporção ≥50% de sintomáticos)';
        v_dimensao_dominante := 'alerta_saude';
        v_override_ativado   := true;  -- [V2-3]
      ELSE
        v_prioridade_motivo  := 'Foco vetorial confirmado com vulnerabilidade crítica';
        v_dimensao_dominante := 'risco_vetorial';
      END IF;

    -- P3: dimensão grave em qualquer eixo
    ELSIF v_risco_vetorial      IN ('critico','alto')
       OR v_risco_socioambiental = 'alto'
       OR v_vuln_domiciliar      IN ('critica','alta')
    THEN
      v_prioridade_final := 'P3';
      -- Dimensão dominante: vetorial > vuln > socioambiental (ordem de criticidade)
      IF v_risco_vetorial = 'critico' THEN
        v_prioridade_motivo  := 'Foco vetorial confirmado em depósito ou calha';
        v_dimensao_dominante := 'risco_vetorial';
      ELSIF v_vuln_domiciliar = 'critica' THEN
        v_prioridade_motivo  := 'Vulnerabilidade crítica: pessoa incapacitada no domicílio';
        v_dimensao_dominante := 'vulnerabilidade_domiciliar';
      ELSIF v_risco_socioambiental = 'alto' THEN
        v_prioridade_motivo  := 'Risco socioambiental alto (score ≥ limiar_medio_alto)';
        v_dimensao_dominante := 'risco_socioambiental';
      ELSIF v_risco_vetorial = 'alto' THEN
        v_prioridade_motivo  := 'Risco vetorial alto: flags ativas sem foco confirmado';
        v_dimensao_dominante := 'risco_vetorial';
      ELSE
        v_prioridade_motivo  := 'Vulnerabilidade domiciliar alta (população vulnerável + risco)';
        v_dimensao_dominante := 'vulnerabilidade_domiciliar';
      END IF;

    -- P4: dimensão moderada em qualquer eixo
    ELSIF v_risco_vetorial       = 'medio'
       OR v_risco_socioambiental  = 'medio'
       OR v_vuln_domiciliar       = 'media'
       OR v_alerta_saude          = 'atencao'
    THEN
      v_prioridade_final := 'P4';
      IF v_alerta_saude = 'atencao' THEN
        v_prioridade_motivo  := 'Sintomas presentes abaixo do limiar de urgência';
        v_dimensao_dominante := 'alerta_saude';
      ELSIF v_risco_vetorial = 'medio' THEN
        -- [V2-6] comportamento conservador documentado (ver seção 10)
        v_prioridade_motivo  := 'Depósitos inspecionados e negativos (inspeção ativa = P4 conservador)';
        v_dimensao_dominante := 'risco_vetorial';
      ELSIF v_risco_socioambiental = 'medio' THEN
        v_prioridade_motivo  := 'Risco socioambiental médio (score entre limiares)';
        v_dimensao_dominante := 'risco_socioambiental';
      ELSE
        v_prioridade_motivo  := 'Vulnerabilidade domiciliar média';
        v_dimensao_dominante := 'vulnerabilidade_domiciliar';
      END IF;

    ELSE
      -- ── [V2-3] Bloco de fallback ──────────────────────────────────────────
      -- Todas as dimensões estão baixo/nenhum.
      -- P3: dados incompletos (fichas faltantes ou flag sem peso)
      -- P5: dados completos e todos negativos (imóvel monitorado e limpo)
      -- P4: vistoria realizada mas sem fichas subsidiárias preenchidas
      v_fallback_aplicado := true;  -- [V2-3]

      IF v_consolidacao_incompleta THEN
        v_prioridade_final   := 'P3';
        v_prioridade_motivo  := 'Consolidação incompleta: dados faltantes ou flag sem peso cadastrado';
        v_dimensao_dominante := NULL;
      ELSIF v_tem_depositos_record OR v_tem_riscos_record OR v_tem_sintomas_record THEN
        v_prioridade_final   := 'P5';
        v_prioridade_motivo  := 'Vistoria completa sem riscos identificados';
        v_dimensao_dominante := NULL;
      ELSE
        v_prioridade_final   := 'P4';
        v_prioridade_motivo  := 'Vistoria realizada sem preenchimento de depósitos ou riscos';
        v_dimensao_dominante := NULL;
      END IF;
    END IF;

  END IF; -- fim camada 1 vs 2

  -- ────────────────────────────────────────────────────────────────────────────
  -- 12. RESUMO TEXTUAL (uma linha para exibição rápida)
  -- ────────────────────────────────────────────────────────────────────────────
  v_consolidacao_resumo := format(
    '%s | VD:%s AS:%s SA:%s RV:%s → %s%s',
    v_resultado_op,
    left(COALESCE(v_vuln_domiciliar,      '?'), 5),
    left(COALESCE(v_alerta_saude,         '?'), 5),
    left(COALESCE(v_risco_socioambiental, '?'), 5),
    left(COALESCE(v_risco_vetorial,       '?'), 6),
    v_prioridade_final,
    CASE WHEN v_consolidacao_incompleta THEN ' [INCOMPLETO]' ELSE '' END
  );

  -- ────────────────────────────────────────────────────────────────────────────
  -- 13. SNAPSHOT JSON (auditabilidade completa — spec V2 seção 7.2)
  --
  --     [V2-3] Novos campos de topo:
  --       override_ativado  : alerta_saude=urgente foi o fator determinante
  --       fallback_aplicado : prioridade definida pelo bloco de fallback
  --       dado_inconsistente: flag ativa sem peso no banco
  -- ────────────────────────────────────────────────────────────────────────────
  v_consolidacao_json := jsonb_build_object(
    'versao_regra',        VERSAO_REGRA,
    'versao_pesos',        v_versao_pesos,
    'consolidado_em',      now(),

    -- [V2-3] Campos de auditoria de alto nível
    'override_ativado',    v_override_ativado,
    'fallback_aplicado',   v_fallback_aplicado,
    'dado_inconsistente',  v_dado_inconsistente,

    'resultado_operacional', jsonb_build_object(
      'resultado',        v_resultado_op,
      'acesso_realizado', v_vistoria.acesso_realizado,
      'sem_acesso_count', v_sem_acesso_count
    ),

    'vulnerabilidade_domiciliar', jsonb_build_object(
      'resultado',      v_vuln_domiciliar,
      'gravidas',       v_vistoria.gravidas,
      'idosos',         v_vistoria.idosos,
      'criancas_7anos', v_vistoria.criancas_7anos,
      'menor_incapaz',  CASE WHEN v_tem_riscos_record THEN v_riscos.menor_incapaz   ELSE NULL END,
      'idoso_incapaz',  CASE WHEN v_tem_riscos_record THEN v_riscos.idoso_incapaz   ELSE NULL END,
      'dep_quimico',    CASE WHEN v_tem_riscos_record THEN v_riscos.dep_quimico     ELSE NULL END,
      'risco_alimentar',CASE WHEN v_tem_riscos_record THEN v_riscos.risco_alimentar ELSE NULL END,
      'risco_moradia',  CASE WHEN v_tem_riscos_record THEN v_riscos.risco_moradia   ELSE NULL END
    ),

    'alerta_saude', jsonb_build_object(
      'resultado',              v_alerta_saude,
      'moradores_qtd',          v_vistoria.moradores_qtd,
      'moradores_sintomas_qtd', CASE WHEN v_tem_sintomas_record THEN v_sintomas.moradores_sintomas_qtd ELSE NULL END,
      'proporcao_sintomas',     v_proporcao_sintomas,
      'febre',                  CASE WHEN v_tem_sintomas_record THEN v_sintomas.febre                ELSE NULL END,
      'manchas_vermelhas',      CASE WHEN v_tem_sintomas_record THEN v_sintomas.manchas_vermelhas    ELSE NULL END,
      'dor_articulacoes',       CASE WHEN v_tem_sintomas_record THEN v_sintomas.dor_articulacoes     ELSE NULL END,
      'dor_cabeca',             CASE WHEN v_tem_sintomas_record THEN v_sintomas.dor_cabeca           ELSE NULL END
    ),

    'risco_socioambiental', jsonb_build_object(
      'resultado',          v_risco_socioambiental,
      'score_total',        v_score_socioambiental,
      'score_social',       v_score_social,
      'score_sanitario',    v_score_sanitario,
      'limiar_baixo_medio', v_limiar_baixo_medio,
      'limiar_medio_alto',  v_limiar_medio_alto,
      'flags_ativas',       to_jsonb(v_flags_ativas),
      -- [V2-2] flags sem peso cadastrado (array vazio = configuração completa)
      'flags_sem_peso',     to_jsonb(v_flags_sem_peso)
    ),

    'risco_vetorial', jsonb_build_object(
      'resultado',                 v_risco_vetorial,
      'dep_inspecionados',         v_dep_inspecionados,
      'dep_focos_total',           v_dep_focos_total,
      'calha_com_foco',            v_calha_com_foco,
      'calha_com_agua_parada',     v_calha_com_agua,
      'acumulo_material_organico', CASE WHEN v_tem_riscos_record THEN v_riscos.acumulo_material_organico ELSE NULL END,
      'animais_sinais_lv',         CASE WHEN v_tem_riscos_record THEN v_riscos.animais_sinais_lv         ELSE NULL END,
      'caixa_destampada',          CASE WHEN v_tem_riscos_record THEN v_riscos.caixa_destampada          ELSE NULL END,
      'outro_risco_vetorial',      CASE WHEN v_tem_riscos_record THEN v_riscos.outro_risco_vetorial      ELSE NULL END
    ),

    'prioridade', jsonb_build_object(
      'final',              v_prioridade_final,
      'motivo',             v_prioridade_motivo,
      'dimensao_dominante', v_dimensao_dominante,
      'incompleta',         v_consolidacao_incompleta
    ),

    -- Completude de sub-tabelas (rastreabilidade de qualidade de dados)
    'cobertura_dados', jsonb_build_object(
      'tem_sintomas',  v_tem_sintomas_record,
      'tem_riscos',    v_tem_riscos_record,
      'tem_depositos', v_tem_depositos_record
    )
  );

  -- ────────────────────────────────────────────────────────────────────────────
  -- 14. GRAVAR NA VISTORIA
  -- ────────────────────────────────────────────────────────────────────────────
  UPDATE vistorias SET
    resultado_operacional      = v_resultado_op,
    vulnerabilidade_domiciliar = v_vuln_domiciliar,
    alerta_saude               = v_alerta_saude,
    risco_socioambiental       = v_risco_socioambiental,
    risco_vetorial             = v_risco_vetorial,
    prioridade_final           = v_prioridade_final,
    prioridade_motivo          = v_prioridade_motivo,
    dimensao_dominante         = v_dimensao_dominante,
    consolidacao_resumo        = v_consolidacao_resumo,
    consolidacao_json          = v_consolidacao_json,
    consolidacao_incompleta    = v_consolidacao_incompleta,
    versao_regra_consolidacao  = VERSAO_REGRA,
    versao_pesos_consolidacao  = v_versao_pesos,
    consolidado_em             = now(),
    -- Reprocessamento: preenche apenas quando havia consolidação anterior
    reprocessado_em  = CASE WHEN v_vistoria.consolidado_em IS NOT NULL THEN now()      ELSE reprocessado_em  END,
    reprocessado_por = CASE WHEN v_vistoria.consolidado_em IS NOT NULL THEN auth.uid() ELSE reprocessado_por END
  WHERE id = p_vistoria_id;

END;
$$;

-- ── Permissões ─────────────────────────────────────────────────────────────────
REVOKE ALL   ON FUNCTION public.fn_consolidar_vistoria(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_consolidar_vistoria(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.fn_consolidar_vistoria(uuid, text) IS
  'Consolida 6 dimensões de uma vistoria e calcula prioridade_final (P1-P5). '
  'Spec V2, função V2. SECURITY DEFINER para escrita em vistoria_consolidacao_historico. '
  'Fase 3 adicionará trigger pós-INSERT. '
  'V2: arquiva histórico sempre; detecta flags sem peso; override/fallback/dado_inconsistente no JSON; '
  'created_at no ORDER BY de pesos; consolidacao_incompleta expandida para dados faltantes.';
