# Checklist de Validação — Consolidação de Vistoria com Supervisor

**Para uso em sessão presencial ou remota com supervisor no piloto.**
**Duração estimada:** 20–30 minutos.

---

## Pré-requisitos

- [ ] Supervisor logado com papel `supervisor` (não admin)
- [ ] Ao menos 5 vistorias consolidadas no banco (com `prioridade_final` preenchido)
- [ ] Ao menos 1 vistoria com `prioridade_final = 'P1'` ou `'P2'`
- [ ] Ao menos 1 vistoria com `consolidacao_incompleta = true`

---

## Bloco 1 — Leitura rápida de prioridade

**Tela:** `/gestor/central` → seção "Vistorias por prioridade"

- [ ] O supervisor consegue identificar qual vistoria é P1 sem esforço visual?
- [ ] A cor do badge P1 (vermelho) comunica urgência sem explicação prévia?
- [ ] O fundo avermelhado nos itens P1/P2 ajuda a separar do restante da lista?
- [ ] O supervisor consegue distinguir P1 de P2 sem hesitação?

**Pergunta direta:** "Olhando essa lista, qual vistoria você atenderia primeiro?"

---

## Bloco 2 — Entendimento das dimensões

**Tela:** `/gestor/central` → hover em qualquer vistoria com badges de dimensão

- [ ] O supervisor entende o que significam os badges (ex: "Vetorial crítico", "Saúde urgente")?
- [ ] Os badges adicionam contexto útil ou apenas poluem visualmente?
- [ ] O supervisor sabe que pode clicar para ver o imóvel no mapa?

**Pergunta direta:** "O que esse badge 'Vetorial crítico' significa para você na prática?"

---

## Bloco 3 — Percepção de dados incompletos

**Tela:** `/gestor/central` → filtro "Incompletas"

- [ ] O supervisor encontra o filtro "Incompletas" sem orientação?
- [ ] O ícone ⚠ e o texto "Incompleto" comunicam que a vistoria precisa revisão?
- [ ] O supervisor entende que "incompleto" não significa "errado", mas "revisar"?

**Pergunta direta:** "O que você faria ao ver 'Incompleto' em uma vistoria P1?"

---

## Bloco 4 — Percepção de "sem acesso"

**Tela:** `/gestor/focos/:id` → tab "Inspeções"

- [ ] O supervisor identifica visualmente as vistorias sem acesso (badge âmbar "Sem acesso")?
- [ ] A distinção entre vistoria realizada e sem acesso está clara no cabeçalho do card?
- [ ] O supervisor consegue ver o histórico de tentativas de acesso de um imóvel?

**Pergunta direta:** "Como você saberia quantas vezes um agente tentou acessar esse imóvel?"

---

## Bloco 5 — Consistência entre telas

**Sequência:** abrir mesmo imóvel em `/gestor/focos/:id` e em `/gestor/central`

- [ ] O P1/P2 exibido no detalhe do foco é o mesmo exibido na lista central?
- [ ] As dimensões mostradas nas duas telas são consistentes?
- [ ] O supervisor percebe que está vendo o mesmo dado em contextos diferentes?

**Pergunta direta:** "Essa prioridade P2 que aparece aqui é a mesma que você viu na lista?"

---

## Bloco 6 — Usabilidade dos filtros

**Tela:** `/gestor/central` → filtros P1 / P2 / P3–P5 / Incompletas

- [ ] O supervisor usa os filtros sem instrução?
- [ ] Os labels "P1", "P2", "P3–P5" são autoexplicativos?
- [ ] O comportamento do filtro "Incompletas" é independente dos filtros de prioridade?
- [ ] O contador de itens ("mostrando X de Y") é útil?

---

## Bloco 7 — Visão do agente (FichaImovel360)

**Tela:** `/agente/imovel/:id` → seção "Visitas recentes"

- [ ] O agente consegue ver a prioridade da última vistoria sem abrir nenhum detalhe?
- [ ] A borda vermelha/laranja em P1/P2 chama atenção adequada no mobile?
- [ ] As dimensões são legíveis em tela pequena?

---

## Observações livres

_(Anotar aqui qualquer dificuldade, confusão ou sugestão levantada pelo supervisor durante a sessão)_

```
1.
2.
3.
```

---

## Critério de aprovação

A consolidação está pronta para uso operacional se:

- Blocos 1, 2 e 3 forem concluídos sem precisar de explicação extra
- Nenhum item crítico (marcado com "sem hesitação" ou "sem instrução") falhar
- O supervisor conseguir responder as perguntas diretas corretamente

---

**Data da validação:** ___________
**Supervisor presente:** ___________
**Validado por:** ___________
