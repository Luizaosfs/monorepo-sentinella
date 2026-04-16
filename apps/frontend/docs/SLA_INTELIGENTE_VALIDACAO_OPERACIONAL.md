# PLANO DE VALIDAÇÃO OPERACIONAL — SLA INTELIGENTE (SENTINELLA)

**Versão:** 1.0
**Momento:** Pós-implantação Fase A + B + C
**Objetivo:** Validar o SLA Inteligente em operação real antes de evoluir para automação

---

# 1. OBJETIVO DA VALIDAÇÃO

Confirmar que o SLA Inteligente:

* representa corretamente a realidade operacional
* ajuda o gestor a tomar decisões
* não gera ruído ou sobrecarga
* melhora tempo de resposta dos focos
* é compreendido pelos usuários

---

# 2. ESCOPO DA VALIDAÇÃO

## Incluído

* CentralOperacional (contadores + top 5)
* GestorFocos (lista com SLA inteligente)
* GestorFocoDetalhe (card SLA inteligente)
* Gargalo por fase
* Ordenação por prioridade

## Não incluído (neste momento)

* Alertas automáticos (push/email)
* Escalonamento automático
* Mudança de fluxo do agente
* Alteração do SLA operacional existente

---

# 3. PERFIS ENVOLVIDOS

## 👨‍💼 Supervisor (principal usuário)

Responsável por:

* acompanhar painel
* priorizar focos
* tomar decisões

## 👷 Agente

Impacto indireto:

* recebe priorização (via gestor)
* NÃO interage com SLA inteligente diretamente

---

# 4. ROTINA DE VALIDAÇÃO (DIÁRIA)

## 4.1 Início do dia (Supervisor)

Abrir:
👉 Central Operacional

Verificar:

* quantidade de focos:

  * 🔴 vencidos
  * 🟠 críticos
  * 🟡 atenção

### Perguntas-chave:

* Faz sentido a quantidade?
* Algum foco deveria estar crítico e não está?
* Algum foco está vencido sem motivo?

---

## 4.2 Identificação de prioridade

Clicar nos contadores:

* vencido → lista filtrada
* crítico → lista filtrada

Verificar:

* os focos listados são realmente os mais urgentes?
* a ordenação está correta?
* o tempo no estado parece coerente?

---

## 4.3 Análise de gargalo

Ver seção:

👉 Gargalo por fase

Exemplo:

* triagem: 25 focos
* inspeção: 10 focos
* tratamento: 3 focos

### Perguntas:

* essa distribuição reflete a realidade?
* existe fila acumulada em alguma etapa?
* isso ajuda a tomar decisão?

---

## 4.4 Ação operacional

Selecionar focos críticos/vencidos:

* abrir detalhe
* verificar SLA inteligente
* priorizar agente

### Validar:

* o gestor usa essa informação para agir?
* o SLA ajuda ou atrapalha a decisão?

---

# 5. ROTINA SEMANAL

## 5.1 Revisão de consistência

Verificar:

* focos vencidos recorrentes
* fases que acumulam sempre
* tempo médio por fase (mesmo que visualmente)

### Perguntas:

* os prazos fazem sentido?
* triagem está curta ou longa demais?
* inspeção está sendo gargalo constante?

---

## 5.2 Ajuste de percepção

Coletar feedback:

* "isso está ajudando?"
* "o que está confuso?"
* "o que você ignora?"

---

# 6. MÉTRICAS DE VALIDAÇÃO

## 6.1 Quantitativas

* % de focos vencidos por dia
* tempo médio até inspeção
* tempo médio até resolução
* volume por fase

---

## 6.2 Qualitativas

* gestor usa o painel diariamente? (sim/não)
* gestor confia no SLA? (sim/não)
* gestor muda decisão com base no SLA? (sim/não)

---

# 7. SINAIS DE PROBLEMA

Se ocorrer qualquer um:

## 🔴 Problemas críticos

* muitos focos "vencidos" sem motivo
* SLA não bate com realidade
* gestor ignora completamente o painel
* ordenação não faz sentido

## 🟡 Problemas médios

* gargalo não representa realidade
* tempo no estado parece errado
* thresholds (70% / 90%) não fazem sentido

---

# 8. SINAIS DE SUCESSO

Você sabe que deu certo quando:

* gestor começa o dia olhando o SLA
* usa os contadores para priorizar
* consegue identificar gargalo sem perguntar
* toma decisão mais rápido
* reduz focos esquecidos

---

# 9. AJUSTES POSSÍVEIS (APÓS VALIDAÇÃO)

## 9.1 Ajuste de prazo por fase

Exemplo:

* triagem → 4h → pode virar 2h ou 8h
* inspeção → 24h → pode virar 48h

## 9.2 Ajuste de thresholds

* atenção: 70% → pode virar 60%
* crítico: 90% → pode virar 85%

## 9.3 Ajuste de UI

* cores mais suaves
* mais destaque para vencidos
* menos destaque para ok

---

# 10. O QUE NÃO FAZER AINDA

❌ criar alerta automático
❌ mandar push/email
❌ mudar fluxo do agente
❌ automatizar decisão
❌ mexer no SLA operacional

👉 tudo isso só depois da validação

---

# 11. DURAÇÃO DO PERÍODO DE VALIDAÇÃO

Recomendado:

👉 15 a 30 dias

Motivo:

* pega variação real de operação
* evita ajuste prematuro
* garante confiança

---

# 12. RESULTADO ESPERADO

Ao final da validação você deve ter:

* prazos calibrados
* confiança do gestor
* clareza de gargalos
* base para automação futura

---

# 13. PRÓXIMO PASSO (APÓS VALIDAÇÃO)

Somente depois disso:

👉 Fase 2 do SLA Inteligente:

* alertas automáticos
* escalonamento
* notificações
* analytics históricos

---

# CONCLUSÃO

O SLA Inteligente já está tecnicamente pronto.

Agora o objetivo não é evoluir código.

👉 É validar comportamento real.

Esse documento garante que você evolua com base em realidade, não em suposição.
