# Modelo de Dados

## Cliente

Representa uma prefeitura.

Campos principais:

- id
- nome
- slug
- cnpj
- contato_email
- contato_telefone

## Região

Representa uma divisão territorial dentro da prefeitura.

Campos:

- id
- cliente_id
- nome
- tipo

## Bairro

Subdivisão de uma região.

Campos:

- id
- regiao_id
- nome

## Planejamento

Representa a organização da atividade.

Campos:

- id
- cliente_id
- regiao_id
- bairro_id
- tipo (drone ou manual)
- data_planejamento
- status

## Levantamento

Representa a execução de um planejamento.

Campos:

- id
- planejamento_id
- data_inicio
- data_fim
- operador_responsavel

## Levantamento Item

Representa cada problema identificado.

Campos:

- id
- levantamento_id
- tipo_problema
- risco
- peso
- latitude
- longitude
- imagem_url
- status

## Plano de Ação

Representa a ação aplicada para resolver o problema.

Campos:

- id
- levantamento_item_id
- descricao
- data_execucao
- operador_id