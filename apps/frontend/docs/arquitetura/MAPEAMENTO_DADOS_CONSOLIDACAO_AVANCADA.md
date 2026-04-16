# Mapeamento de Dados — Consolidação Avançada da Vistoria

> Versão: P8 | Data: 2026-04-14
> Gerado a partir da análise de `fn_consolidar_vistoria` V2.0.0

Este documento mapeia cada campo real da vistoria à dimensão analítica que ele influencia.
Nenhum conceito foi criado por chute — tudo deriva do preenchimento real da vistoria.

---

## Entidades envolvidas

| Tabela | Conteúdo |
|---|---|
| `vistorias` | Registro base da visita (acesso, moradores, grupos vulneráveis) |
| `vistoria_sintomas` | Sintomas reportados pelos moradores |
| `vistoria_riscos` | Fatores sociais, sanitários e vetoriais identificados |
| `vistoria_depositos` | Depósitos inspecionados e com focos |
| `vistoria_calhas` | Estado das calhas (foco, água parada) |

---

## Dimensão 1 — `resultado_operacional`

**Valores:** `visitado` | `sem_acesso` | `sem_acesso_retorno`

| Campo | Tabela | Influência | Confiança |
|---|---|---|---|
| `acesso_realizado` (bool) | `vistorias` | `true/NULL` → visitado; `false` → sem_acesso | Alta |
| Contagem histórica de `acesso_realizado=false` no imóvel | `vistorias` (histórico) | ≥2 tentativas → sem_acesso_retorno | Alta |

**Observação:** `visitado` é o estado normal. Badge só aparece quando `sem_acesso` ou `sem_acesso_retorno`.

---

## Dimensão 2 — `vulnerabilidade_domiciliar`

**Valores:** `baixa` | `media` | `alta` | `critica` | `inconclusivo`

| Campo | Tabela | Influência | Dimensão | Confiança |
|---|---|---|---|---|
| `gravidas` (bool) | `vistorias` | Vulnerabilidade média (base) | vulnerabilidade | Alta |
| `idosos` (bool) | `vistorias` | Vulnerabilidade média (base) | vulnerabilidade | Alta |
| `criancas_7anos` (bool) | `vistorias` | Vulnerabilidade média (base) | vulnerabilidade | Alta |
| `menor_incapaz` (bool) | `vistoria_riscos` | Eleva para crítica (imediato) | vulnerabilidade | Alta |
| `idoso_incapaz` (bool) | `vistoria_riscos` | Eleva para crítica (imediato) | vulnerabilidade | Alta |
| `dep_quimico` (bool) | `vistoria_riscos` | Combinado com vulnerável → alta | vulnerabilidade | Alta |
| `risco_alimentar` (bool) | `vistoria_riscos` | Combinado com vulnerável → alta | vulnerabilidade | Alta |
| `risco_moradia` (bool) | `vistoria_riscos` | Combinado com vulnerável → alta | vulnerabilidade | Alta |

**Hierarquia de cálculo:**
1. `critica` — `menor_incapaz=true` OU `idoso_incapaz=true`
2. `alta` — grupo vulnerável (grávida/idoso/criança) + risco de moradia/alimentar/dependência química
3. `media` — qualquer grupo vulnerável OU qualquer risco social isolado
4. `baixa` — nenhuma das condições acima
5. `inconclusivo` — sem acesso (dados não coletados)

---

## Dimensão 3 — `alerta_saude`

**Valores:** `nenhum` | `atencao` | `urgente` | `inconclusivo`

| Campo | Tabela | Influência | Confiança |
|---|---|---|---|
| `febre` (bool) | `vistoria_sintomas` | Sintoma dengue-like | Alta |
| `manchas_vermelhas` (bool) | `vistoria_sintomas` | Sintoma dengue-like | Alta |
| `dor_articulacoes` (bool) | `vistoria_sintomas` | Sintoma dengue-like | Alta |
| `dor_cabeca` (bool) | `vistoria_sintomas` | Sintoma dengue-like | Alta |
| `moradores_sintomas_qtd` (int) | `vistoria_sintomas` | Numerador da proporção | Alta |
| `moradores_qtd` (int) | `vistorias` | Denominador da proporção | Alta |

**Regra de cálculo:**
- Sintoma dengue-like presente AND proporção ≥ 50% → `urgente` (override de prioridade para ≥ P2)
- Sintoma dengue-like presente AND proporção < 50% → `atencao`
- Moradores sintomáticos sem sintoma específico → `atencao`
- Sem sintomas → `nenhum`
- Sem acesso → `inconclusivo`

**Limite:** o alerta é operacional, não diagnóstico. Não substitui avaliação médica.

---

## Dimensão 4 — `risco_socioambiental`

**Valores:** `baixo` | `medio` | `alto` | `inconclusivo`

| Campo | Tabela | Eixo | Influência | Confiança |
|---|---|---|---|---|
| `dep_quimico` (bool) | `vistoria_riscos` | Social | Score social | Alta |
| `risco_alimentar` (bool) | `vistoria_riscos` | Social | Score social | Alta |
| `risco_moradia` (bool) | `vistoria_riscos` | Social | Score social | Alta |
| `menor_incapaz` (bool) | `vistoria_riscos` | Social | Score social | Alta |
| `idoso_incapaz` (bool) | `vistoria_riscos` | Social | Score social | Alta |
| `criadouro_animais` (bool) | `vistoria_riscos` | Sanitário | Score sanitário | Alta |
| `lixo` (bool) | `vistoria_riscos` | Sanitário | Score sanitário | Alta |
| `residuos_organicos` (bool) | `vistoria_riscos` | Sanitário | Score sanitário | Alta |
| `residuos_quimicos` (bool) | `vistoria_riscos` | Sanitário | Score sanitário | Alta |
| `residuos_medicos` (bool) | `vistoria_riscos` | Sanitário | Score sanitário | Alta |

**Regra de cálculo:** score_total = score_social + score_sanitário (pesos em `consolidacao_pesos_config`)
- score ≥ `limiar_medio_alto` → `alto`
- score ≥ `limiar_baixo_medio` → `medio`
- score < `limiar_baixo_medio` → `baixo`
- Sem registro de riscos em vistoria visitada → `baixo` (ausência = negativo)
- Sem acesso → `inconclusivo`

---

## Dimensão 5 — `risco_vetorial`

**Valores:** `baixo` | `medio` | `alto` | `critico` | `inconclusivo`

| Campo | Tabela | Influência | Confiança |
|---|---|---|---|
| `qtd_com_focos` (int) | `vistoria_depositos` | SUM > 0 → crítico | Alta |
| `qtd_inspecionados` (int) | `vistoria_depositos` | SUM > 0 → tem_depositos_record | Alta |
| `com_foco` (bool) | `vistoria_calhas` | true → crítico | Alta |
| `condicao` = `com_agua_parada` | `vistoria_calhas` | bool_or → alto | Alta |
| `acumulo_material_organico` (bool) | `vistoria_riscos` | Flag vetorial → alto | Alta |
| `animais_sinais_lv` (bool) | `vistoria_riscos` | Flag vetorial → alto | Alta |
| `caixa_destampada` (bool) | `vistoria_riscos` | Flag vetorial → alto | Alta |
| `outro_risco_vetorial` (text) | `vistoria_riscos` | Preenchido → alto | Média |

**Hierarquia:**
1. `critico` — foco confirmado em depósito ou calha
2. `alto` — flag vetorial ativa OU calha com água parada (sem foco confirmado)
3. `medio` — depósitos inspecionados todos negativos (conservador intencional)
4. `baixo` — visitado sem dados de campo vetorial
5. `inconclusivo` — sem acesso

---

## Dimensão 6 — `prioridade_final`

**Valores:** `P1` | `P2` | `P3` | `P4` | `P5`

Síntese das 5 dimensões acima. Calculada em 2 camadas:

**Camada 1 — Sem acesso:**
| Tentativas | Prioridade |
|---|---|
| ≥ 5 | P2 |
| ≥ 3 | P3 |
| 1–2 | P4 |

**Camada 2 — Visitado (matriz de dimensões):**
| Condição | Prioridade |
|---|---|
| alerta_saude=urgente + risco elevado ≥1 dimensão | P1 |
| alerta_saude=urgente (isolado) OU (vetorial=crítico + vuln=crítica) | P2 |
| vetorial∈{crítico,alto} OU social=alto OU vuln∈{crítica,alta} | P3 |
| vetorial=médio OU social=médio OU vuln=média OU saúde=atenção | P4 |
| Todas baixo/nenhum + dados completos | P5 |
| Todas baixo/nenhum + dados incompletos | P3 (conservador) |

---

## Campos não utilizados na consolidação

| Campo | Tabela | Motivo |
|---|---|---|
| `qtd_eliminados` | `vistoria_depositos` | Não influencia risco — é ação corretiva |
| `usou_larvicida` / `qtd_larvicida_g` | `vistoria_depositos` | Ação corretiva, não risco |
| `posicao` | `vistoria_calhas` | Localização, não risco |
| `acessivel` | `vistoria_calhas` | Não lido pela função |
| `tratamento_realizado` | `vistoria_calhas` | Ação corretiva |
| `tipo` | `vistoria_depositos` | A função soma todos os tipos |
| `foto_url` / `observacao` | múltiplas | Metadados |

---

## Conceitos solicitados no P8 vs dados disponíveis

| Conceito P8 | Implementável? | Como |
|---|---|---|
| `resultado_operacional` | ✅ Sim | `acesso_realizado` + contagem histórica |
| `vulnerabilidade_domiciliar` | ✅ Sim | grupos vulneráveis + riscos sociais |
| `alerta_saude` | ✅ Sim | sintomas + proporção de moradores |
| `risco_socioambiental` | ✅ Sim | score social + sanitário com pesos |
| `risco_vetorial` | ✅ Sim | depósitos + calhas + flags vetoriais |
| `prioridade_final` | ✅ Sim | matriz completa de dimensões |
| Foco tratado / orientação realizada | ⚠️ Parcial | `vistoria_calhas.tratamento_realizado` existe mas não entra no modelo de risco — correto, é ação corretiva |
| Diagnóstico clínico de saúde | ❌ Não aplicável | Sistema é operacional, não médico |
