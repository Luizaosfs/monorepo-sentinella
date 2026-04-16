# Guia Operacional — Modo Analítico Avançado

> Versão: P8.1 | Data: 2026-04-14
> Público-alvo: supervisor, admin, analista_regional

---

## O que é o modo analítico

O modo analítico é um recurso opcional que exibe informações analíticas detalhadas
sobre as vistorias — informações que normalmente ficam resumidas nos badges coloridos.

Ao ativar, cada card de vistoria passa a mostrar um bloco com os 5 indicadores:
- Resultado operacional da visita
- Vulnerabilidade domiciliar
- Alerta de saúde
- Risco socioambiental
- Risco vetorial

---

## Como ativar

1. Acessar qualquer tela do sistema (como supervisor ou admin)
2. Abrir o menu lateral (sidebar)
3. Role até o fim do menu — localizar o botão **"Modo analítico"**
4. Clicar para ativar — botão ficará azul: **"Analítico ativo"**
5. Para desativar, clicar novamente

> O modo fica salvo. Na próxima vez que acessar o sistema, ele estará no mesmo estado.

---

## Onde aparece

| Tela | O que muda |
|---|---|
| **GestorFocoDetalhe** → aba Vistorias | Cada vistoria ganha bloco detalhado abaixo dos badges |
| **FichaImovel360** → seção Histórico de vistorias | Idem |
| **CentralOperacional** → lista de imóveis | Sem alteração — lista continua enxuta |

---

## Como interpretar o bloco detalhado

```
┌─ Análise detalhada ──────────────────┐
│ Resultado operacional  Visitado       │
│ Vulnerabilidade        Alta           │
│ Alerta de saúde        Atenção        │
│ Risco socioambiental   Médio          │
│ Risco vetorial         Crítico        │
└──────────────────────────────────────┘
```

### Resultado operacional
| Valor | Significado |
|---|---|
| Visitado | Agente entrou no imóvel e coletou dados |
| Sem acesso (1ª vez) | Não conseguiu entrar — primeira tentativa |
| Sem acesso (2ª+ vez) | Múltiplas tentativas sem acesso — risco escalado |

### Vulnerabilidade domiciliar
| Valor | Significado |
|---|---|
| Baixa | Sem grupos ou fatores de risco social |
| Média | Grávida, idoso, criança ≤7 anos, ou fator isolado |
| Alta | Grupo vulnerável + risco de moradia/alimentar/dependência |
| Crítica | Pessoa incapacitada no domicílio — ação imediata |

### Alerta de saúde
| Valor | Significado |
|---|---|
| Nenhum | Sem sintomas reportados |
| Atenção | Sintomas dengue-like em menos de 50% dos moradores |
| Urgente | Sintomas dengue-like em ≥50% dos moradores — prioridade P2+ |

### Risco socioambiental
| Valor | Significado |
|---|---|
| Baixo | Sem fatores sanitários ou sociais identificados |
| Médio | Algum fator isolado (lixo, resíduos, animais) |
| Alto | Combinação de fatores sanitários e sociais |

### Risco vetorial
| Valor | Significado |
|---|---|
| Baixo | Visitado sem evidências de criadouro |
| Médio | Depósitos inspecionados e todos negativos |
| Alto | Flags vetoriais presentes (acúmulo, calha com água) sem foco |
| Crítico | Foco confirmado em depósito ou calha |

---

## Quando ativar o modo analítico

✅ Use quando precisar:
- Entender **por que** um imóvel está em P1 ou P2
- Identificar qual dimensão está puxando a prioridade
- Avaliar se o risco é vetorial, social ou sanitário
- Fazer triagem detalhada de um conjunto de imóveis problemáticos
- Treinar um agente mostrando o que foi coletado e como impactou

❌ Não use quando:
- Fazer varredura rápida de listas (use os badges — são suficientes)
- A prioridade já é conclusiva para a ação
- Estiver em campo (agente não vê o toggle)

---

## Limites do modo analítico

- **Não é diagnóstico:** alerta de saúde "Urgente" não confirma dengue
- **Não é decisão:** prioridade é suporte à decisão, não substituto
- **Não é permanente:** risco de um imóvel muda a cada nova vistoria
- **Não é score pessoal:** vulnerabilidade domiciliar é operacional, não julgamento

---

## Quem pode usar

| Papel | Acessa o toggle? |
|---|---|
| admin | ✅ Sim |
| supervisor | ✅ Sim |
| analista_regional | ✅ Sim |
| agente | ❌ Não (não aparece no menu) |
| notificador | ❌ Não |
