# Modelo Canônico — Consolidação Avançada da Vistoria

> Versão: P8 | Data: 2026-04-14
> Função: `fn_consolidar_vistoria` V2.0.0
> Migração: `20270223000000_consolidacao_vistoria_fase2.sql`

Este documento define o contrato analítico completo da consolidação automática de vistorias.
É a fonte de verdade para desenvolvedores e analistas de operação.

---

## Princípios

1. **Automático:** nenhuma classificação manual do agente
2. **Rastreável:** cada resultado tem `prioridade_motivo` explicando a decisão
3. **Auditável:** `consolidacao_json` guarda snapshot completo com scores e flags
4. **Conservador:** na dúvida, prioridade maior (mais urgente), não menor
5. **Imutável histórico:** `vistoria_consolidacao_historico` guarda versões anteriores

---

## Componentes da consolidação

### 1. `resultado_operacional`

| Atributo | Valor |
|---|---|
| Objetivo | Descrever o que aconteceu operacionalmente na visita |
| Valores | `visitado` / `sem_acesso` / `sem_acesso_retorno` |
| Origem | `vistorias.acesso_realizado` + histórico de tentativas do imóvel |
| Nulo? | Nunca (calculado em toda vistoria) |
| Badge na UI | Apenas `sem_acesso` e `sem_acesso_retorno` geram badge visual |
| Impacto na prioridade | Sem acesso → Camada 1 da matriz (sobrepõe dimensões analíticas) |

**Separação importante:** `resultado_operacional` diz "o que aconteceu".
As demais dimensões dizem "qual é o risco do imóvel".

---

### 2. `vulnerabilidade_domiciliar`

| Atributo | Valor |
|---|---|
| Objetivo | Indicar nível de exposição social dos moradores |
| Escala | `baixa` → `media` → `alta` → `critica` \| `inconclusivo` |
| Origem | `vistorias` (gravidas, idosos, criancas_7anos) + `vistoria_riscos` (incapacitados, riscos sociais) |
| Nulo? | Apenas quando sem_acesso (→ inconclusivo) |
| Impacto na prioridade | `critica` ou `alta` → P2/P3 \| `media` → P4 |

**Não é diagnóstico social.** É um indicador operacional para priorização de visita de retorno.

---

### 3. `alerta_saude`

| Atributo | Valor |
|---|---|
| Objetivo | Sinalizar presença de sintomas dengue-like no domicílio |
| Escala | `nenhum` → `atencao` → `urgente` \| `inconclusivo` |
| Origem | `vistoria_sintomas` (febre, manchas_vermelhas, dor_articulacoes, dor_cabeca) + proporção de sintomáticos |
| Limiar de urgência | Sintoma dengue-like AND ≥50% dos moradores sintomáticos |
| Nulo? | Apenas quando sem_acesso (→ inconclusivo) |
| Impacto na prioridade | `urgente` ativa override — força prioridade ≥ P2 |

**Limite claro:** alerta operacional para encaminhamento. Não substitui avaliação médica.

---

### 4. `risco_socioambiental`

| Atributo | Valor |
|---|---|
| Objetivo | Medir condições sanitárias e sociais do entorno domiciliar |
| Escala | `baixo` → `medio` → `alto` \| `inconclusivo` |
| Origem | `vistoria_riscos` — eixo social (5 flags) + eixo sanitário (5 flags) |
| Cálculo | Score ponderado por `consolidacao_pesos_config` com limiares `limiar_baixo_medio` e `limiar_medio_alto` |
| Flags ativas | Registradas em `consolidacao_json.risco_socioambiental.flags_ativas` |
| Nulo? | Apenas quando sem_acesso (→ inconclusivo) |
| Impacto na prioridade | `alto` → P3 \| `medio` → P4 |

---

### 5. `risco_vetorial`

| Atributo | Valor |
|---|---|
| Objetivo | Medir presença confirmada ou potencial de criadouros |
| Escala | `baixo` → `medio` → `alto` → `critico` \| `inconclusivo` |
| Origem | `vistoria_depositos` + `vistoria_calhas` + flags em `vistoria_riscos` |
| Nulo? | Apenas quando sem_acesso (→ inconclusivo) |
| Impacto na prioridade | `critico` → P2/P3 \| `alto` → P3 \| `medio` → P4 (conservador) |

**Comportamento conservador documentado:** `medio` inclui "todos os depósitos inspecionados e negativos"
— inspeção ativa é valorizada, mesmo sem risco confirmado.

---

### 6. `prioridade_final`

| Atributo | Valor |
|---|---|
| Objetivo | Síntese única para priorização operacional |
| Escala | `P1` (mais urgente) → `P5` (monitoramento) |
| Origem | Matriz das 5 dimensões acima |
| `dimensao_dominante` | Qual dimensão foi determinante para a prioridade |
| `prioridade_motivo` | Texto explicativo legível da decisão |
| `consolidacao_incompleta` | true quando dados faltantes forçam prioridade conservadora |

---

## Campos de auditoria no `consolidacao_json`

```json
{
  "versao_regra": "2.0.0",
  "versao_pesos": "...",
  "consolidado_em": "...",
  "override_ativado": false,
  "fallback_aplicado": false,
  "dado_inconsistente": false,
  "resultado_operacional": { "resultado": "...", "acesso_realizado": true, "sem_acesso_count": 0 },
  "vulnerabilidade_domiciliar": { "resultado": "...", "score": 0, "fatores": [] },
  "alerta_saude": { "resultado": "...", "proporcao_sintomas": 0, "sintomas_presentes": [] },
  "risco_socioambiental": { "resultado": "...", "score_total": 0, "score_social": 0, "score_sanitario": 0, "flags_ativas": [], "flags_sem_peso": [] },
  "risco_vetorial": { "resultado": "...", "dep_focos_total": 0, "dep_inspecionados": 0, "calha_com_foco": false },
  "prioridade": { "final": "P3", "motivo": "...", "dimensao_dominante": "risco_vetorial", "incompleta": false },
  "cobertura_dados": { "tem_sintomas": true, "tem_riscos": true, "tem_depositos": false }
}
```

---

## Ciclo de vida

```
vistoria criada/atualizada
        ↓
trigger (fase3) → fn_consolidar_vistoria()
        ↓
arquiva versão anterior em vistoria_consolidacao_historico
        ↓
calcula 6 dimensões
        ↓
grava em vistorias (colunas de output + consolidacao_json)
        ↓
UI lê direto das colunas — nunca recalcula no frontend
```

---

## Triggers de reprocessamento (fase3)

| Tabela | Evento | Colunas monitoradas |
|---|---|---|
| `vistorias` | INSERT | — |
| `vistorias` | UPDATE | acesso_realizado, status, moradores_qtd, gravidas, idosos, criancas_7anos |
| `vistoria_sintomas` | INSERT / DELETE / UPDATE | febre, manchas_vermelhas, dor_articulacoes, dor_cabeca, moradores_sintomas_qtd |
| `vistoria_riscos` | INSERT / DELETE / UPDATE | todas as flags sociais, sanitárias e vetoriais |
| `vistoria_depositos` | INSERT / DELETE / UPDATE | qtd_com_focos, qtd_inspecionados |
| `vistoria_calhas` | INSERT / DELETE / UPDATE | com_foco, condicao |

---

## Responsabilidades por camada

| Camada | Responsabilidade |
|---|---|
| Banco (`fn_consolidar_vistoria`) | Calcular e persistir todos os 6 componentes |
| `consolidacao_pesos_config` | Pesos e limiares configuráveis por cliente |
| `api.ts` | Expor campos consolidados via SELECT sem recalcular |
| `DimensoesBadges` | Exibir 4 dimensões analíticas + resultado_operacional |
| `ConsolidacaoBlock` | Exibir painel completo com motivo + data + resumo técnico |
| Frontend | Nunca recalcular — apenas exibir/interpretar o que vem do banco |
