# Integrações do Sistema

## Supabase

O Supabase é utilizado como banco de dados principal.

Funções:

- armazenamento de dados operacionais
- gerenciamento de usuários
- API de acesso aos dados

Tecnologia base:
PostgreSQL

## Cloudinary

O Cloudinary é utilizado para armazenamento de imagens relevantes.

Exemplos:

- evidências de problemas
- recortes de imagens detectadas pelo YOLO
- imagens registradas em campo

## YOLO

O YOLO é utilizado para detecção automática de objetos nas imagens capturadas por drone.

O modelo identifica possíveis criadouros relacionados à dengue.

## ExifTool

O ExifTool é utilizado para extrair metadados das imagens capturadas pelo drone.

Informações extraídas:

- latitude
- longitude
- altitude
- data e hora
- orientação da câmera

## Sistema Sentinela Python

O sistema Python é responsável por:

- execução de voos
- processamento de imagens
- extração de metadados
- análise com YOLO
- envio de dados para o backend