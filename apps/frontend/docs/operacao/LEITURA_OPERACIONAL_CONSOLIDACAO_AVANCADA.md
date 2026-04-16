# Leitura Operacional — Consolidação Avançada da Vistoria

> Versão: P8 | Data: 2026-04-14
> Público-alvo: supervisores, gestores municipais e instrutores de piloto

Este documento explica como interpretar os indicadores da consolidação automática de vistorias.

---

## Visão rápida (para usar em campo)

A consolidação tem **duas camadas de leitura**:

### Camada 1 — Leitura rápida (em qualquer lista)
- **Prioridade final** (P1–P5) → "o quão urgente é retornar a este imóvel"
- **Dimensão dominante** → "por que essa prioridade"
- **Badge de incompleto** → "há dados faltantes; revisar antes de decidir"

### Camada 2 — Leitura analítica (no detalhe da vistoria)
- Resultado operacional + 4 dimensões de risco + motivo explícito
- Útil para encaminhamento, priorização e planejamento de rota

---

## O que cada indicador significa

### Prioridade final (P1–P5)

| Prioridade | Significado operacional | Ação esperada |
|---|---|---|
| **P1** | Urgência máxima — sintomas + risco crítico | Retorno imediato (< 4h) |
| **P2** | Alta urgência — saúde urgente OU foco + vulnerabilidade crítica OU sem acesso recorrente (≥5x) | Retorno no dia |
| **P3** | Risco grave identificado ou sem acesso frequente (3–4x) | Retorno em até 24h |
| **P4** | Risco moderado ou primeira tentativa sem acesso | Retorno em até 72h |
| **P5** | Vistoria completa — sem riscos identificados | Monitoramento regular |

---

### Resultado operacional

| Badge | Significado |
|---|---|
| *(sem badge)* | Visita realizada normalmente (`visitado`) |
| **Sem acesso** | Agente foi ao local mas não conseguiu entrar — 1ª tentativa |
| **Sem acesso (2ª+)** | Já houve 2 ou mais tentativas sem acesso — escalação automática |

> Quando aparece "Sem acesso", os demais indicadores ficam como "?" porque os dados não foram coletados.

---

### Vulnerabilidade domiciliar

Indica o nível de exposição social dos moradores com base no perfil de saúde e condições de vida.

| Nível | Significa |
|---|---|
| **Vuln. baixa** | Sem grupos vulneráveis ou fatores de risco social identificados |
| **Vuln. média** | Grávida, idoso ou criança ≤7 anos — ou fator de risco social isolado |
| **Vuln. alta** | Grupo vulnerável combinado com risco de moradia, alimentar ou dependência química |
| **Vuln. crítica** | Pessoa incapacitada no domicílio (menor ou idoso) — exige atenção imediata |

**O que NÃO significa:** não é diagnóstico de vulnerabilidade socioeconômica nem avaliação de assistência social. É um indicador para priorização de retorno.

---

### Alerta de saúde

Indica presença de sintomas compatíveis com dengue/arboviroses nos moradores.

| Nível | Significa |
|---|---|
| **Saúde ok** | Nenhum sintoma reportado |
| **Saúde atenção** | Sintomas presentes mas em menos de 50% dos moradores |
| **Saúde urgente** | Sintoma dengue-like (febre, manchas, dor articular) em ≥50% dos moradores — **eleva prioridade para P2 ou P1** |

**O que NÃO significa:** não é diagnóstico médico. O alerta é operacional — serve para encaminhar ao serviço de saúde, não para tratar clinicamente. A decisão médica cabe ao profissional de saúde.

---

### Risco socioambiental

Mede condições sanitárias e sociais identificadas no imóvel e entorno.

| Nível | Significa |
|---|---|
| **Social baixo** | Sem fatores de risco sanitário ou social identificados |
| **Social médio** | Algum fator isolado (ex: lixo, resíduos, animais) |
| **Social alto** | Combinação de fatores que eleva o risco ambiental do domicílio |

Fatores que contribuem: acúmulo de lixo, resíduos orgânicos/químicos/médicos, criação de animais, dependência química, risco alimentar, risco de moradia.

---

### Risco vetorial

Mede presença confirmada ou potencial de criadouros de Aedes aegypti.

| Nível | Significa |
|---|---|
| **Vetorial baixo** | Visitado sem evidências de criadouro |
| **Vetorial médio** | Depósitos inspecionados e negativos (inspeção ativa registrada) |
| **Vetorial alto** | Flags vetoriais presentes (acúmulo, caixa destampada, calha com água) — sem foco confirmado |
| **Vetorial crítico** | Foco confirmado em depósito ou calha — **eleva prioridade para P2/P3** |

> **Por que "médio" em depósito negativo?** É um comportamento conservador intencional: a inspeção ativa é valorizada mesmo sem foco, pois indica monitoramento real do imóvel. Imóvel com P5 = vistoria completa e todas as dimensões baixo/nenhum.

---

## Como o supervisor deve interpretar

### Cenário típico de encaminhamento

1. **P1 ou P2 com Saúde urgente** → Encaminhar para serviço de saúde + retorno imediato do agente
2. **P1 ou P2 com Vetorial crítico** → Ação de tratamento vetorial prioritária
3. **P2 ou P3 com Sem acesso (2ª+)** → Acionar estratégia alternativa (visita noturna, autorização judicial, etc.)
4. **P3 com Vuln. crítica** → Checar necessidade de acionamento de assistência social
5. **P4 com Social alto** → Planejar visita de orientação sanitária

### O que a prioridade NÃO substitui

- Julgamento contextual do agente em campo
- Avaliação médica dos moradores
- Decisão administrativa sobre recursos e rotas

---

## Como o agente deve usar

O agente **não precisa classificar nada manualmente.** A consolidação é automática após o preenchimento da vistoria.

O agente deve:
1. Preencher todos os campos da vistoria com fidelidade ao que viu
2. Registrar acesso ou ausência de acesso corretamente
3. Marcar grupos vulneráveis se identificados
4. Registrar sintomas reportados pelos moradores
5. Inspecionar e registrar depósitos e calhas

O sistema faz o resto.

---

## Limites da interpretação

| Afirmação | Correto? |
|---|---|
| "P1 significa que há dengue no domicílio" | ❌ Não — P1 indica risco e urgência, não diagnóstico |
| "Saúde urgente significa dengue confirmada" | ❌ Não — é alerta operacional baseado em sintomas |
| "Vetorial crítico significa que o foco vai gerar doença" | ❌ Não — é criadouro confirmado, não transmissão |
| "P5 significa que o imóvel está livre para sempre" | ❌ Não — é o resultado desta vistoria; nova visita pode mudar |
| "A prioridade substitui decisão do supervisor" | ❌ Não — é suporte à decisão, não substituto |

---

## Glossário rápido

| Termo | Significado |
|---|---|
| Consolidação | Processamento automático de todos os dados da vistoria em um conjunto de indicadores |
| Dimensão dominante | Qual dimensão teve maior peso na determinação da prioridade final |
| Incompleto | Dados faltantes que impediram cálculo preciso — prioridade conservadora aplicada |
| Override | Alerta de saúde urgente sobrepõe a matriz e força prioridade mínima P2 |
| Fallback | Todas as dimensões baixo/nenhum — prioridade determinada por completude dos dados |
| P1–P5 | Escala de prioridade: P1 = mais urgente, P5 = monitoramento |
