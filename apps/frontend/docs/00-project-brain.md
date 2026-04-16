# Project Brain — Sentinela

## Objetivo
Este projeto é o Sentinela, um sistema para monitoramento de focos de risco relacionados à dengue para prefeituras, com fluxo de coleta por drone e fluxo manual.

## Como a IA deve trabalhar neste projeto
Antes de responder, sugerir código ou propor mudanças, leia e respeite esta documentação:

1. docs/01-contexto-geral.md
2. docs/domain.md
3. docs/arquitetura.md
4. docs/regras-de-negocio.md
5. docs/fluxo-drone.md
6. docs/fluxo-manual.md
7. docs/clima-sla.md
8. docs/integracoes.md
9. docs/modelo-dados.md
10. docs/roadmap.md
11. docs/03-regras-imutaveis.md

## Regra principal
Não alterar código existente sem autorização explícita.
Quando solicitado a ajudar:
- primeiro entender o contexto
- depois explicar o impacto
- depois sugerir opções
- só gerar código se eu pedir explicitamente

## Forma esperada de resposta
- sempre considerar o domínio do projeto
- nunca assumir regras sem consultar a documentação
- apontar dúvidas e impactos antes de propor refactor
- preservar arquitetura existente
- não simplificar regras de negócio já definidas
- respeitar nomenclatura do projeto

## Resumo do domínio
O sistema possui planejamento, levantamentos e levantamento_itens.
Há dois fluxos principais:
- fluxo drone
- fluxo manual

O sistema utiliza dados de imagens, EXIF, classificação por IA, regras de risco, SLA e integrações externas.

## Prioridade de verdade
Se houver conflito entre hipótese e documentação, a documentação é a fonte de verdade.
Se houver conflito entre documentação e código legado, apontar a divergência e pedir decisão antes de alterar.