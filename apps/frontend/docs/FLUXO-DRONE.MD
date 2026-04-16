# Fluxo de Operação com Drone

## Objetivo
Automatizar a identificação de possíveis focos de dengue utilizando imagens capturadas por drone.

## Etapas do Processo

### 1 Planejamento
Um planejamento é criado para determinada região ou bairro.

Esse planejamento será executado por drone.

### 2 Execução do voo
O voo é executado através do sistema Sentinela em Python.

Durante o voo:
- imagens são capturadas automaticamente
- normalmente a cada poucos segundos

### 3 Coleta das imagens
As imagens são armazenadas localmente.

Cada imagem contém metadados importantes como:

- latitude
- longitude
- altitude
- data e hora
- orientação da câmera

### 4 Extração de metadados
Os metadados são extraídos utilizando a ferramenta ExifTool.

Essas informações são transformadas em arquivos estruturados (JSON ou CSV).

### 5 Análise de imagens
As imagens são analisadas por um modelo de visão computacional utilizando YOLO.

O modelo identifica possíveis criadouros como:

- pneu
- recipiente
- piscina suja
- caixa d'água aberta
- lixo ou entulho
- poça de água

### 6 Classificação de risco
Cada objeto identificado recebe:

- classificação de risco
- peso de risco
- ação recomendada

### 7 Geração de evidências
Quando um problema relevante é identificado:

- a imagem ou recorte é enviada para o Cloudinary
- é criado um registro no levantamento_item

### 8 Registro no banco
As informações são enviadas para o banco de dados (Supabase / PostgreSQL).

Os dados são vinculados ao levantamento associado ao planejamento.

### 9 Validação em campo
Após a análise automática, um operador pode selecionar o levantamento para:

- visitar o local
- validar o problema
- registrar evidência adicional
- aplicar plano de ação