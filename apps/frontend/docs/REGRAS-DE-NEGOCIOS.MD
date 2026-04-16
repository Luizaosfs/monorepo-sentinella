# Regras de Negócio — Sentinela

## Cliente

Cada cliente representa uma prefeitura.

Um cliente pode possuir:

- várias regiões
- vários bairros
- vários planejamentos

---

## Planejamento

Todo levantamento deve estar associado a um planejamento.

Um planejamento pode ser:

- Drone
- Manual

Um planejamento pertence a:

- cliente
- região ou bairro
- data

---

## Levantamento

O levantamento representa a execução do planejamento.

Ele contém os registros das evidências coletadas.

**Regra de unicidade:** existe no máximo **um levantamento por (cliente, planejamento, data do dia, tipo de entrada)**. Ou seja, por dia e por planejamento há um único levantamento, com 1→N itens. Itens manuais criados no mobile no mesmo dia e no mesmo planejamento são agrupados no mesmo levantamento.

Um levantamento pode ser originado de:

- voo com drone
- inspeção manual

---

## Levantamento Item

Cada problema identificado gera um levantamento_item.

Cada item deve possuir:

- tipo de problema
- nível de risco
- peso de risco
- localização
- evidência em imagem

---

## Classificação de risco

Cada tipo de problema possui um peso de risco.

Exemplo:

piscina_suja → risco alto  
pneu → risco médio  
recipiente pequeno → risco baixo  

Esses pesos podem ser configuráveis por prefeitura.

---

## Evidência

Todo problema identificado deve possuir evidência.

A evidência pode ser:

- imagem capturada pelo drone
- imagem capturada pelo operador
- registro manual

---

## Plano de ação

Após validação do problema, o operador pode registrar ações.

Exemplos:

- eliminação de água
- notificação
- tratamento com larvicida

---

## Rastreamento obrigatório

O sistema deve permitir rastrear:

cliente  
→ planejamento  
→ levantamento  
→ levantamento_item  
→ evidência  
→ plano de ação

---

## SLA

Cada item identificado pode possuir prazo de tratamento.

O sistema deve permitir:

- monitorar itens vencidos
- gerar alertas
- priorizar ações