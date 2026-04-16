# Arquitetura do Sistema — Sentinela

## Visão Geral

O Sentinela é uma plataforma SaaS para monitoramento de possíveis focos de dengue utilizando:

- planejamento operacional
- inspeção manual em campo
- inspeção automatizada com drones
- análise de imagens com visão computacional

A arquitetura foi projetada para suportar múltiplas prefeituras (multi-tenant).

---

# Camadas do Sistema

O sistema segue separação clara entre domínio, serviços e infraestrutura.

## Domain
Contém as regras de negócio puras.

Exemplos:
- Planejamento
- Levantamento
- LevantamentoItem
- PlanoAcao
- Regiao
- Bairro

Essa camada não deve depender de frameworks ou banco de dados.

---

## Services

Responsável por orquestrar fluxos de negócio.

Exemplos:

- criação de planejamento
- execução de levantamento
- processamento de imagens
- cálculo de risco
- geração de mapa

---

## Infra

Camada responsável por integrações externas.

Exemplos:

- Supabase
- Cloudinary
- APIs climáticas
- armazenamento de imagens
- repositórios de banco

---

## Presentation

Interface do sistema.

Pode incluir:

- painel web
- dashboards
- mapas interativos
- relatórios

---

# Arquitetura do módulo Drone

Fluxo geral:

Drone
→ captura de imagens
→ extração de metadados (ExifTool)
→ análise com YOLO
→ classificação de risco
→ geração de evidências
→ persistência no banco

---

# Armazenamento

Dados estruturados:
- PostgreSQL (Supabase)

Imagens:
- Cloudinary

---

# Escalabilidade

O sistema foi projetado para suportar:

- múltiplas prefeituras
- grandes volumes de imagens
- múltiplos operadores simultâneos
- processamento automatizado de imagens

---

# Princípios arquiteturais

Separação de responsabilidades

Rastreabilidade completa entre entidades

Baixo acoplamento entre módulos

Facilidade de expansão para novas análises de imagens

Facilidade de integração com novos sensores ou drones