# TERMO DE TRATAMENTO DE DADOS PESSOAIS — SENTINELLA
**Versão:** 1.0
**Data:** 2026-04-02
**Base legal:** Lei 13.709/2018 (LGPD)

> **Nota:** Este documento é um modelo de referência. Para uso legal, deve ser revisado por advogado habilitado especializado em proteção de dados.

---

## TERMO DE TRATAMENTO DE DADOS PESSOAIS

**CONTROLADOR:**
Prefeitura Municipal de {{MUNICIPIO}}
CNPJ: {{CNPJ_PREFEITURA}}
Doravante denominado **CONTROLADOR**

**OPERADOR:**
{{RAZAO_SOCIAL_SENTINELLA}}
CNPJ: {{CNPJ_SENTINELLA}}
Doravante denominado **OPERADOR**

---

## CLÁUSULA 1 — DEFINIÇÕES

Para fins deste Termo, adotam-se as definições da Lei 13.709/2018 (LGPD) e, adicionalmente:

- **Plataforma:** sistema Sentinella, SaaS fornecido pelo OPERADOR ao CONTROLADOR
- **Dados Operacionais:** dados inseridos pelo CONTROLADOR na plataforma referentes à operação de vigilância epidemiológica (imóveis, vistorias, focos, levantamentos)
- **Dados de Saúde:** dados relacionados a casos notificados de dengue, chikungunya ou zika, inseridos pelas unidades de saúde do CONTROLADOR

---

## CLÁUSULA 2 — DADOS PESSOAIS TRATADOS

### 2.1 Dados dos usuários da plataforma
Dados necessários para autenticação e operação do sistema:

| Dado | Finalidade | Base legal |
|---|---|---|
| Nome completo | Identificação do usuário | Execução de contrato (art. 7º, V) |
| E-mail | Autenticação e comunicação | Execução de contrato (art. 7º, V) |
| Papel/perfil | Controle de acesso (RBAC) | Execução de contrato (art. 7º, V) |
| Endereço IP | Segurança e auditoria de acesso | Legítimo interesse (art. 7º, IX) |
| Localização GPS | Checkin em vistorias (agentes) | Execução de contrato (art. 7º, V) |
| Fotografias | Evidências de vistorias | Execução de contrato (art. 7º, V) |

### 2.2 Dados de pacientes (casos notificados)
A plataforma Sentinella foi projetada para **não armazenar dados pessoais identificáveis de pacientes**, em conformidade com a LGPD e o princípio da minimização de dados.

**NÃO são coletados:**
- Nome do paciente
- CPF / RG
- Data de nascimento
- Número de prontuário ou registro hospitalar
- Qualquer outro identificador direto

**SÃO coletados (dados não identificáveis diretamente):**

| Dado | Finalidade | Base legal |
|---|---|---|
| Endereço de residência (logradouro + bairro) | Cruzamento geoespacial com focos de campo | Proteção da saúde (art. 11, II, f) |
| Coordenadas GPS do endereço | Cruzamento geoespacial com focos de campo | Proteção da saúde (art. 11, II, f) |
| Doença suspeita/confirmada | Vigilância epidemiológica | Proteção da saúde (art. 11, II, f) |
| Data de início dos sintomas | Análise epidemiológica | Proteção da saúde (art. 11, II, f) |
| Unidade de saúde notificadora | Rastreabilidade | Proteção da saúde (art. 11, II, f) |

> Os dados de saúde são considerados dados sensíveis nos termos do art. 11 da LGPD. O tratamento é permitido para proteção da saúde pública, conforme art. 11, II, f.

### 2.3 Dados de munícipes (denúncias pelo canal cidadão)
Formulário público de denúncia de focos. Não exige cadastro ou login.

| Dado | Finalidade | Base legal |
|---|---|---|
| Tipo de problema reportado | Criação de foco de risco | Legítimo interesse / saúde pública |
| Endereço do foco | Localização do foco | Legítimo interesse / saúde pública |
| Protocolo (8 caracteres) | Consulta de status pelo cidadão | Legítimo interesse / saúde pública |

**NÃO são coletados:** nome, CPF, e-mail ou telefone do denunciante.

---

## CLÁUSULA 3 — FINALIDADES DO TRATAMENTO

O OPERADOR trata os dados pessoais descritos na Cláusula 2 exclusivamente para as seguintes finalidades:

a) Prestação dos serviços contratados (plataforma Sentinella)
b) Suporte técnico e resolução de problemas
c) Segurança da plataforma e prevenção de fraudes
d) Cumprimento de obrigações legais e regulatórias
e) Melhoria e aprimoramento da plataforma (apenas com dados anonimizados/agregados)

**É vedado ao OPERADOR:**
- Usar os dados para fins comerciais próprios
- Compartilhar com terceiros para fins de marketing
- Treinar modelos de inteligência artificial com dados identificáveis
- Criar perfis individuais de munícipes ou pacientes

---

## CLÁUSULA 4 — COMPARTILHAMENTO DE DADOS

### 4.1 Suboperadores autorizados
O OPERADOR utiliza os seguintes suboperadores, com os quais compartilha dados necessários à operação da plataforma:

| Suboperador | Função | País | Garantias |
|---|---|---|---|
| Supabase Inc. | Banco de dados, autenticação, armazenamento | EUA (infraestrutura AWS São Paulo) | SOC 2, GDPR compliant |
| Resend Inc. | Envio de e-mails transacionais | EUA | GDPR compliant |
| Cloudinary Ltd. | Armazenamento de imagens | EUA/nuvem | SOC 2, GDPR compliant |
| Google LLC | Geocodificação de endereços (Maps API) | EUA | GDPR compliant, SCCs |

### 4.2 Transferência internacional
Os dados são armazenados principalmente no Brasil (AWS São Paulo). Quando processados em servidores no exterior (ex.: geocodificação via Google Maps API), são adotadas garantias adequadas conforme art. 33 da LGPD.

### 4.3 Órgãos públicos
O OPERADOR poderá compartilhar dados com autoridades públicas exclusivamente quando exigido por lei, ordem judicial ou determinação da ANPD.

---

## CLÁUSULA 5 — MEDIDAS DE SEGURANÇA

O OPERADOR adota as seguintes medidas técnicas e organizacionais:

**Técnicas:**
- Criptografia em trânsito (TLS 1.3)
- Criptografia em repouso (AES-256)
- Autenticação por e-mail + senha com MFA opcional
- Row Level Security (RLS) no banco de dados — cada prefeitura acessa somente seus próprios dados
- Controle de acesso por papel (RBAC) com 4 níveis: admin, supervisor, operador, notificador
- Logs de auditoria de acesso e modificações

**Organizacionais:**
- Política de acesso mínimo necessário
- Credenciais de produção restritas à equipe técnica essencial
- Procedimento de resposta a incidentes com SLA de 24h para notificação
- Treinamento periódico da equipe sobre proteção de dados

---

## CLÁUSULA 6 — RETENÇÃO E EXCLUSÃO

| Dado | Período de retenção | Após o período |
|---|---|---|
| Dados de usuários | Duração do contrato + 5 anos | Exclusão permanente |
| Dados operacionais (vistorias, focos) | Duração do contrato + 5 anos | Exclusão permanente |
| Dados de casos notificados | Duração do contrato + 5 anos | Exclusão permanente ou anonimização |
| Logs de auditoria | 2 anos | Exclusão permanente |
| Backups de banco de dados | 30 dias (Básico/Profissional), 90 dias (Enterprise) | Exclusão permanente |

**Após rescisão do contrato:**
- Dados disponíveis para exportação por 90 dias
- Findo o prazo: exclusão permanente e irrecuperável
- Certificado de exclusão emitido mediante solicitação

---

## CLÁUSULA 7 — DIREITOS DOS TITULARES

O CONTROLADOR é responsável pelo atendimento dos direitos dos titulares (art. 18 da LGPD). O OPERADOR apoiará o CONTROLADOR neste atendimento:

| Direito | Prazo de atendimento pelo OPERADOR após solicitação do CONTROLADOR |
|---|---|
| Confirmação e acesso | 72 horas |
| Correção de dados | 72 horas |
| Anonimização, bloqueio ou eliminação | 5 dias úteis |
| Portabilidade | 5 dias úteis |
| Eliminação após revogação de consentimento | 5 dias úteis |

---

## CLÁUSULA 8 — INCIDENTES DE SEGURANÇA

8.1. Em caso de incidente que possa acarretar risco ou dano relevante aos titulares, o OPERADOR notificará o CONTROLADOR em até **24 (vinte e quatro) horas** da ciência do incidente.

8.2. A notificação conterá:
- Descrição dos dados afetados
- Número estimado de titulares afetados
- Medidas técnicas adotadas para contenção
- Medidas adotadas para mitigar o impacto

8.3. O CONTROLADOR é responsável por notificar a ANPD e os titulares conforme os arts. 48 e 49 da LGPD.

---

## CLÁUSULA 9 — ENCARREGADO DE DADOS (DPO)

**CONTROLADOR (Prefeitura):**
Nome: {{NOME_DPO_PREFEITURA}}
E-mail: {{EMAIL_DPO_PREFEITURA}}

**OPERADOR (Sentinella):**
Nome: {{NOME_DPO_SENTINELLA}}
E-mail: `privacidade@sentinella.com.br`

---

## CLÁUSULA 10 — DISPOSIÇÕES FINAIS

10.1. Este Termo integra o Contrato de Prestação de Serviços como Anexo III.

10.2. Em caso de conflito entre este Termo e o Contrato Principal, prevalece o Contrato Principal no que não contrariar a LGPD.

10.3. Alterações neste Termo requerem concordância escrita de ambas as partes com antecedência mínima de 30 dias.

10.4. A ANPD tem competência para fiscalizar o cumprimento da LGPD pelas partes.

---

## ASSINATURAS

Local e data: {{MUNICIPIO}}, {{DATA}}.

**CONTROLADOR:**

____________________________________
{{NOME_REPRESENTANTE}}
{{CARGO}} — Prefeitura Municipal de {{MUNICIPIO}}

**OPERADOR:**

____________________________________
{{NOME_REPRESENTANTE_SENTINELLA}}
{{CARGO_SENTINELLA}} — {{RAZAO_SOCIAL_SENTINELLA}}
