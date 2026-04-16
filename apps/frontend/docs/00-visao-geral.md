# 00 — Visão Geral do Sentinella Web

> **Para quem é este documento:** qualquer pessoa nova no projeto — desenvolvedor, analista, gestor ou parceiro — que queira entender o sistema antes de qualquer detalhe técnico.

---

## O que é o Sentinella Web?

O **Sentinella Web** é uma plataforma de software voltada para prefeituras municipais brasileiras. Seu objetivo é organizar, executar e monitorar ações de vigilância epidemiológica contra o mosquito Aedes aegypti — o vetor da dengue, chikungunya e zika.

Ele não é apenas um painel de visualização. É uma ferramenta operacional completa que cobre o ciclo inteiro:

```
Identificar um foco → Priorizar → Atribuir → Tratar em campo → Registrar → Auditar
```

O sistema une tecnologias diferentes em um único ambiente:
- **Drone + visão computacional** para identificar focos em imagens aéreas
- **Vistoria domiciliar** por agentes de campo, imóvel por imóvel
- **Dados climáticos** para prever janelas de risco de proliferação
- **Notificações de casos** de dengue vindas de postos de saúde
- **SLA operacional** para garantir que nenhum foco crítico fique sem atendimento

---

## Qual problema resolve?

Municípios brasileiros enfrentam epidemias cíclicas de dengue. A vigilância tradicional depende de inspeção manual, planilhas e sistemas federais lentos (como o SINAN). Isso gera:

- Focos sem atendimento por falta de priorização
- Operadores sem visibilidade de onde ir primeiro
- Gestores sem dados confiáveis para tomar decisões
- Sem rastreabilidade de quem fez o quê e quando

O Sentinella resolve cada um desses pontos com fluxos digitais, automações e dados em tempo real.

---

## Para quem é o sistema?

O sistema tem **cinco perfis de usuário** com portais distintos:

| Perfil | Portal principal | Responsabilidade |
|--------|-----------------|-----------------|
| **Admin** | Todo o sistema | Suporte SaaS; gerencia todas as prefeituras |
| **Supervisor** | Dashboard + admin | Admin de uma prefeitura; configura SLA, usuários, planejamentos |
| **Usuário (gestor)** | Dashboard + mapa + levantamentos | Acompanha operações; gera relatórios |
| **Operador** | `/operador/*` | Atende focos no campo; faz vistorias domiciliares |
| **Notificador** | `/notificador/*` | Funcionário de UBS/hospital que registra casos de dengue |
| **Cidadão** | `/denuncia/:slug` | Faz denúncias via QR code, sem login |

> **Multitenancy:** cada prefeitura é um cliente isolado. Dados de uma prefeitura nunca são visíveis para outra — isso é garantido tanto no banco de dados quanto na aplicação.

---

## Quais são os módulos principais?

### 1. Planejamentos e Levantamentos
O ponto de partida de toda operação. Um **planejamento** define onde e como a equipe vai atuar (drone ou manual). O **levantamento** é a execução — o conjunto de evidências coletadas naquela operação. Cada evidência individual vira um **item de levantamento**.

### 2. Focos de Risco _(entidade central do ciclo operacional)_
A entidade mais importante do sistema. Cada suspeita de foco de dengue vira um **foco de risco** com ciclo de vida próprio: começa como suspeita, pode ser confirmado, tratado e resolvido — ou descartado. Todo o processo de atendimento é gerenciado aqui.

### 3. SLA Operacional
Cada foco confirmado ganha um prazo máximo de atendimento. Se não for resolvido no prazo, o SLA é violado. Os prazos variam conforme a prioridade do foco, o risco climático da região e a configuração da prefeitura.

### 4. Vistoria Domiciliar
Agentes de campo visitam imóveis um a um, registrando depósitos de água, sintomas de moradores, larvas encontradas e larvicida aplicado. O formulário tem 5 etapas e funciona offline.

### 5. Risco Pluviométrico
O sistema analisa dados de chuva por bairro diariamente. A janela de maior risco é 3–6 dias após chuva intensa, quando larvas estão em desenvolvimento ativo. Isso gera alertas e SLAs preventivos.

### 6. Centro de Notificações de Casos
UBS, UPAs e hospitais registram casos de dengue. O sistema cruza automaticamente cada caso com focos próximos (até 300 metros) e eleva a prioridade deles.

### 7. Canal Cidadão
Qualquer cidadão pode denunciar um foco suspeito via QR code, sem criar conta. A denúncia chega diretamente para os gestores da prefeitura.

### 8. Módulos de análise e relatórios
Heatmap temporal animado, comparativo entre levantamentos, painel de municípios, score de surto por bairro, relatório semanal automático por email e exportações PDF.

---

## Qual é o fluxo macro da operação?

Existem quatro fluxos principais que se cruzam:

```
DRONE:
  Planejamento → Voo Python → YOLO detecta focos → Itens criados → Foco de risco nasce
  → Operador atende no campo → Foco resolvido

MANUAL:
  Planejamento → Agente vistoria imóvel → Depósito com larva → Foco de risco nasce
  → Operador atende → Foco resolvido

PLUVIO:
  Chuva intensa → Sistema calcula risco por bairro → SLA preventivo criado
  → Operador recebe alerta → Vai ao campo

CASO NOTIFICADO:
  UBS registra caso de dengue → Sistema cruza com focos próximos (300m)
  → Prioridade dos focos elevada → Operador prioriza a área
```

---

## Como frontend, backend, banco e RLS se relacionam?

```
NAVEGADOR (React + TypeScript)
  ↓ usa
src/services/api.ts  ← único ponto de contato com o banco
  ↓ chama
Supabase PostgreSQL  ← banco de dados com regras embutidas
  ↓ aplica
RLS (Row Level Security) ← garante isolamento por prefeitura no próprio banco
```

**O que isso significa na prática:**

- **O frontend** constrói interfaces, valida formulários e exibe dados. Não acessa o banco diretamente — tudo passa pelo arquivo `api.ts`.
- **O `api.ts`** é a camada de serviço: cada função ali chama o Supabase com os filtros corretos de `cliente_id`.
- **O banco** (Supabase/PostgreSQL) contém não só os dados, mas também regras de negócio críticas: automações por triggers (SLA criado automaticamente, histórico de mudanças), funções de cálculo (prazo de SLA, cruzamento geoespacial) e políticas de acesso (RLS).
- **O RLS** é a última linha de defesa: mesmo que o frontend cometa um erro e esqueça de filtrar por `cliente_id`, o banco rejeita o dado.

---

## Quais entidades são centrais?

| Entidade | O que representa |
|----------|-----------------|
| `clientes` | Uma prefeitura. Raiz de todo dado do sistema. |
| `regioes` | Divisão territorial dentro da prefeitura (bairros, zonas). |
| `planejamentos` | Organização de uma operação de campo (drone ou manual). |
| `levantamentos` | Execução de um planejamento em uma data específica. |
| `levantamento_itens` | Cada foco ou evidência identificada. Imutável após criado. |
| **`focos_risco`** | **O ciclo de vida operacional de cada foco. Estado, responsável, prazo, histórico.** |
| `sla_operacional` | O prazo e status de atendimento de cada foco confirmado. |
| `imoveis` | Edificações cadastradas e visitáveis pelos agentes. |
| `vistorias` | Cada visita de um agente a um imóvel. |
| `casos_notificados` | Casos de dengue registrados por unidades de saúde. |
| `usuarios` | Membros da equipe, com papel definido. |

---

## Estado atual do sistema

- **Versão:** 2.1.0
- **Banco de dados:** 87+ migrations aplicadas (março de 2025 a julho de 2026)
- **Páginas:** 44+
- **Edge Functions:** 12
- **Tipos TypeScript:** 1.410+ linhas, 79 interfaces documentadas
- **Camada de serviço:** 2.831 linhas em `api.ts`

O sistema está em uso real, em evolução ativa, e passou por uma mudança arquitetural significativa em julho de 2026: a introdução da entidade `focos_risco` como **aggregate root** do ciclo operacional — tornando-se o coração do sistema a partir desse ponto.

---

## Como navegar a documentação completa

| Arquivo | O que contém |
|---------|-------------|
| `01-contexto-produto.md` | Problema de negócio, público, proposta de valor, módulos |
| `02-arquitetura-geral.md` | Camadas técnicas, decisões, fluxo de dados |
| `03-backend.md` | Edge Functions, triggers, RPCs, api.ts |
| `04-frontend.md` | Páginas, componentes, hooks, estado |
| `05-banco-de-dados.md` | Tabelas, migrations, views, funções |
| `06-rls-e-seguranca.md` | Segurança, RBAC, LGPD |
| `07-regras-de-negocio.md` | Regras catalogadas e onde cada uma vive |
| `08-fluxos-operacionais.md` | Fluxos passo a passo por módulo |
| `09-divida-tecnica.md` | O que está frágil ou acoplado demais |
| `10-riscos-e-falhas.md` | Riscos identificados com severidade |
| `11-melhorias-priorizadas.md` | O que melhorar e em que ordem |
| `12-roadmap-implementacao.md` | Plano de execução em etapas |
| `13-padroes-de-desenvolvimento.md` | Convenções, padrões, checklist |
| `14-glossario.md` | Termos do domínio e técnicos |

---

*Análise baseada no código-fonte real em 2026-03-26. Versão 2.1.0 do sistema.*
