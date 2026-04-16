# PROPOSTA COMERCIAL — SENTINELLA
**Data:** {{DATA}}
**Validade:** 30 dias
**Proposta nº:** {{NUMERO}}

---

**Apresentamos a:**

**Prefeitura Municipal de** {{MUNICIPIO}}
**Secretaria Municipal de Saúde**
**CNPJ:** {{CNPJ_PREFEITURA}}
**Endereço:** {{ENDERECO_PREFEITURA}}
**Responsável:** {{NOME_RESPONSAVEL}} — {{CARGO}}
**E-mail:** {{EMAIL_RESPONSAVEL}}
**Telefone:** {{TELEFONE_RESPONSAVEL}}

---

## 1. OBJETO

Contratação de licença de uso da plataforma **Sentinella** — sistema SaaS para gestão de vigilância epidemiológica de campo, com as funcionalidades descritas nesta proposta.

---

## 2. DIAGNÓSTICO DO MUNICÍPIO

| Informação | Valor |
|---|---|
| Município | {{MUNICIPIO}} |
| UF | {{UF}} |
| Código IBGE | {{IBGE}} |
| Habitantes (estimado) | {{HABITANTES}} |
| Imóveis a vistoriar (estimado) | {{IMOVEIS}} |
| Agentes de campo ativos | {{AGENTES}} |
| Unidades de saúde (UBS/UPA) | {{UNIDADES_SAUDE}} |
| Plano recomendado | {{PLANO}} |

---

## 3. SOLUÇÃO PROPOSTA

### 3.1 Módulos incluídos

**Gestão Operacional de Campo:**
- Vistoria digital de imóveis com 5 etapas (responsável, sintomas, inspeção, tratamento, riscos)
- Suporte a todos os tipos de depósito PNCD (A1–E)
- Funcionamento offline — agentes trabalham sem internet e sincronizam ao voltar
- Registro de tentativas sem acesso com fluxo guiado
- Rota otimizada no mapa para o agente

**Gestão de Focos de Risco:**
- Registro e rastreamento de focos com 7 estados de progresso
- SLA automático com alertas por push no navegador
- Timeline de auditoria por foco
- Integração com casos notificados (cruzamento geoespacial 300m)

**Painel do Supervisor:**
- Central do Dia com KPIs em tempo real
- Mapa de focos com heatmap temporal
- Monitoramento de produtividade dos agentes
- LIRAa automatizado por quarteirão e ciclo
- Score territorial de risco por imóvel e bairro
- Relatório semanal automático por e-mail

**Canal Cidadão:**
- QR Code para denúncia sem login
- Protocolo de acompanhamento para o cidadão
- Alertas push ao supervisor quando nova denúncia chega

**Centro de Casos Notificados:**
- Registro por unidades de saúde (sem dados pessoais — LGPD)
- Cruzamento automático com focos de campo em 300m
- Elevação automática de prioridade de focos cruzados

**Módulo de Drone (conforme plano):**
- Gestão de voos e levantamentos aéreos
- Análise por IA de imagens com identificação de focos
- Mapa comparativo antes/depois por levantamento

**Integração CNES:**
- Sincronização automática com a base DATASUS
- Atualização diária das unidades de saúde do município

**Integração e-SUS Notifica (conforme plano):**
- Notificação automática de casos confirmados
- Suporte aos ambientes de homologação e produção

---

## 4. INVESTIMENTO

### 4.1 Licença mensal

| Item | Descrição | Valor mensal |
|---|---|---|
| Licença {{PLANO}} | Plataforma Sentinella — {{IMOVEIS}} imóveis, {{AGENTES}} agentes | R$ {{VALOR_PLANO}} |
| **Total mensal** | | **R$ {{VALOR_PLANO}}** |

### 4.2 Implantação (pagamento único)

| Item | Descrição | Valor |
|---|---|---|
| Implantação {{MODALIDADE_IMPLANTACAO}} | Configuração, importação, criação de usuários, treinamento, suporte 2 semanas | R$ {{VALOR_IMPLANTACAO}} |

### 4.3 Resumo do investimento

| Item | Valor |
|---|---|
| Implantação (pagamento único) | R$ {{VALOR_IMPLANTACAO}} |
| Licença mensal | R$ {{VALOR_PLANO}}/mês |
| **Total no 1º mês** | **R$ {{TOTAL_PRIMEIRO_MES}}** |
| **Total no 2º mês em diante** | **R$ {{VALOR_PLANO}}/mês** |
| **Total 12 meses** | **R$ {{TOTAL_12_MESES}}** |

### 4.4 Opção com desconto anual

| Modalidade | Valor |
|---|---|
| Contrato anual (12 meses) | R$ {{VALOR_ANUAL}} (equivale a 10 meses — 2 meses grátis) |
| Desconto | R$ {{DESCONTO_ANUAL}} ({{PCT_DESCONTO}}%) |

---

## 5. O QUE ESTÁ INCLUSO NA IMPLANTAÇÃO

- Configuração do cliente na plataforma (regiões, bairros, quarteirões)
- Importação e validação da base de imóveis fornecida pela prefeitura
- Sincronização das unidades de saúde (CNES/DATASUS)
- Criação de todos os usuários (supervisor, agentes, notificadores)
- Treinamento do supervisor (4 horas)
- Treinamento dos agentes de campo (2 horas por agente ou grupo)
- Treinamento dos notificadores das UBSs (1 hora)
- Suporte assistido nas primeiras 2 semanas de operação
- Primeiro relatório de piloto entregue ao secretário de saúde

---

## 6. O QUE A PREFEITURA PRECISA PROVIDENCIAR

- Planilha de imóveis (logradouro, número, bairro — formato Excel ou CSV)
- Lista de agentes de campo com e-mails válidos
- Lista de supervisores e notificadores com e-mails válidos
- Código IBGE do município (7 dígitos)
- Lista de feriados municipais do ano vigente
- Smartphones dos agentes com Android 8+ ou iOS 13+ (dispositivos já em uso)
- Acesso à internet nos dispositivos (dados móveis ou Wi-Fi)

---

## 7. QUOTAS E LIMITES DO PLANO {{PLANO}}

| Recurso | Limite mensal |
|---|---|
| Imóveis cadastrados | {{QUOTA_IMOVEIS}} |
| Vistorias realizadas | {{QUOTA_VISTORIAS}} |
| Agentes de campo ativos | {{QUOTA_AGENTES}} |
| Levantamentos | {{QUOTA_LEVANTAMENTOS}} |
| Voos de drone | {{QUOTA_DRONES}} |
| Chamadas de IA | {{QUOTA_IA}} |

> O sistema notifica ao atingir 70% de qualquer quota. Upgrades são aplicados pro-rata.

---

## 8. CRONOGRAMA DE IMPLANTAÇÃO

| Etapa | Prazo |
|---|---|
| Assinatura do contrato | Dia 0 |
| Envio da base de imóveis pela prefeitura | Até dia 3 |
| Configuração da plataforma | Dia 5–7 |
| Treinamento supervisor | Dia 8 |
| Treinamento agentes | Dia 9–10 |
| Início da operação real | Dia 14 |
| Relatório de acompanhamento do piloto (30 dias) | Dia 45 |
| Apresentação ao secretário de saúde | Dia 60 |

---

## 9. CONDIÇÕES COMERCIAIS

| Condição | Valor |
|---|---|
| Forma de pagamento | Boleto bancário ou PIX |
| Vencimento | Todo dia 5 do mês |
| Reajuste anual | IPCA |
| Multa por cancelamento antecipado (anual) | 20% do saldo restante |
| Prazo mínimo de aviso para cancelamento | 30 dias |
| Portabilidade dos dados | Exportação gratuita em CSV/JSON a qualquer momento |

---

## 10. VALIDADE E ACEITE

Esta proposta é válida por **30 dias** a partir da data de emissão.

O aceite pode ser formalizado por:
- Assinatura do contrato SaaS (ver `CONTRATO_SAAS.md`)
- Assinatura da Ordem de Serviço de Implantação
- E-mail de confirmação pelo responsável da prefeitura

---

**Sentinella — Tecnologia em Vigilância Epidemiológica**

E-mail: `comercial@sentinella.com.br`
WhatsApp: (XX) XXXXX-XXXX
Site: `sentinella.com.br`

---

*Elaborada por: {{NOME_VENDEDOR}}*
*Data: {{DATA}}*
