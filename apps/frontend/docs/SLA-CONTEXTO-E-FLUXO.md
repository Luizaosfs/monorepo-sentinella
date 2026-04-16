# SLA — Contexto e fluxo

Este documento explica o que é o SLA na aplicação Sentinella Map e como ele funciona de ponta a ponta.

---

## O que é SLA aqui?

**SLA** (Service Level Agreement) no app é o **prazo em horas** para que uma ação corretiva seja feita em um ponto de risco. Exemplos:

- **Pluviometria operacional:** um bairro com risco “Alta” pode ter SLA de 12h para receber intervenção (drenagem, larvicida etc.).
- **Levantamentos (drone):** um item detectado no mapa pode ter um campo `sla_horas` indicando quantas horas restam para atendimento.

Ou seja: **SLA = prazo para “resolver” ou atender aquele ponto**.

---

## Dois contextos de SLA no app

O sistema usa SLA em **dois lugares** diferentes:

| Contexto | Onde aparece | Origem do prazo |
|----------|----------------|------------------|
| **SLA Operacional (pluvio)** | Tela **SLA Operacional** (`/operador`), **Gestão de SLA** (`/admin/sla`), widget no Dashboard, sino de alertas | Tabela `sla_operacional`, ligada a `pluvio_operacional_item` (bairro/região em um “run” pluviométrico). Prazo vem da **prioridade operacional** e da **configuração de SLA por cliente**. |
| **SLA no mapa (levantamento)** | **Mapa** de inspeção, **Levantamentos**, relatórios PDF | Campo `sla_horas` em **levantamento_itens** (itens do voo/drone). Usado para mostrar “quantas horas” naquele ponto; pode vir de regra fixa ou cálculo no processamento do levantamento. |

**Comparação detalhada (operacional vs mapa):** `docs/SLA-OPERACIONAL-VS-MAPA.md`

O restante deste doc foca no **SLA Operacional (pluvio)**, que é o fluxo completo com status, operador e alertas.

---

## Fluxo do SLA Operacional (pluvio)

### 1. Dados de entrada: pluviometria operacional

- Existe **pluvio_operacional_run** (uma “rodada” de análise por cliente, com data de referência).
- Cada **pluvio_operacional_item** é um **bairro/região** nessa rodada, com:
  - classificação de risco (ex.: Alto, Crítico),
  - **prioridade_operacional** (ex.: Urgente, Alta, Média, Baixa),
  - outros dados (chuva 24h, tendência etc.).

Esses itens são a “fonte” dos SLAs: **cada SLA operacional está ligado a um `pluvio_operacional_item`** (um bairro em um run).

### 2. Configuração do SLA (admin)

- **Menu:** Cadastros → **Gestão de SLA** (`/admin/sla`), aba **Configuração**.
- **Tabela:** `sla_config` (por cliente).
- O admin define:
  - **Horas por prioridade** (ex.: Crítica = 4h, Alta = 12h, Baixa = 72h).
  - **Fatores de redução** (ex.: risco “Muito Alto” reduz 30%, persistência > 3 dias reduz 20%, temperatura > 30°C reduz 10%).
  - **Horário comercial** (opcional): considerar só certo período do dia para contar o prazo.

Essa config é usada para **calcular o prazo (sla_horas)** e, em algum processo (backend ou função no banco), para **criar ou atualizar** os registros em `sla_operacional`.

### 3. Tabela `sla_operacional`

Cada linha representa **um SLA para um item (bairro)**:

- **item_id** → `pluvio_operacional_item.id`
- **inicio** → quando o SLA “começou a contar”
- **prazo_final** → data/hora limite para concluir
- **sla_horas** → prazo em horas (ex.: 12)
- **status** → `pendente` | `em_atendimento` | `concluido` | `vencido`
- **operador_id** → usuário responsável (opcional)
- **violado** → true se foi concluído depois do prazo (ou marcado vencido)
- **escalonado** / **prioridade_original** → quando o SLA foi escalado (ex.: de Média para Urgente)

**Quem cria** os registros em `sla_operacional` não está no frontend: pode ser um job, trigger ou função no Supabase que, a partir de `pluvio_operacional_item` e da `sla_config`, insere/atualiza essas linhas. O app apenas **lê e atualiza** (status, operador, concluido_em, etc.).

### 4. Onde o SLA operacional aparece

| Onde | O que faz |
|------|-----------|
| **SLA Operacional** (`/operador`) | Lista SLAs do cliente (operador vê só os seus; admin/supervisor vê todos). Permite: **Assumir** (pendente → em atendimento), **Concluir**, e ver prazo restante / vencido. |
| **Gestão de SLA** (`/admin/sla`) | Lista completa, **atribuir operador**, forçar status (ex.: concluído, vencido), **configuração por cliente**, **ranking de operadores**, **exportar PDF**, **auditoria**. |
| **Dashboard** | Widget “SLA Operacional” com SLAs urgentes; **Sino de alertas** (SlaAlertBell) mostra SLAs próximos do vencimento ou vencidos e abre o painel. |
| **Hook useSlaAlerts** | A cada 1 minuto busca SLAs pendentes/em atendimento do cliente e dispara **toast** + **notificação do navegador** para itens em warning, vencidos ou escalonados. |

### 5. Estados e ações típicas

- **pendente** → Ninguém assumiu. Operador pode clicar em **Assumir** → vira **em_atendimento** (e pode gravar `operador_id`).
- **em_atendimento** → Alguém está cuidando. Pode **Concluir** → **concluido** (e grava `concluido_em`; se passou do prazo, marca `violado`).
- **vencido** → Prazo passou sem conclusão (pode ser definido por job ou manualmente pelo admin).
- **concluido** → Fechado (no prazo ou com violação).

Cálculo de “tempo restante” e “vencido” usa sempre **prazo_final** e a hora atual.

### 6. Resumo do fluxo (em ordem lógica)

1. **Dados pluvio:** Run + itens (bairros) com prioridade e risco.
2. **Config SLA:** Admin define horas por prioridade e fatores na **Gestão de SLA**.
3. **Geração dos SLAs:** Em algum momento (job/trigger/função), são criados/atualizados registros em `sla_operacional` para cada item relevante, com `inicio`, `prazo_final`, `sla_horas`, `status = pendente`.
4. **Operador:** Em **SLA Operacional**, assume e conclui SLAs; admin pode atribuir operador e forçar status em **Gestão de SLA**.
5. **Alertas:** useSlaAlerts + SlaAlertBell avisam quando SLA está próximo do vencimento ou vencido.
6. **Métricas:** Cumprido %, violado %, ranking de operadores e relatório PDF em **Gestão de SLA**.

---

## SLA no mapa (levantamento_itens)

Nos **levantamentos** (voos/drone), cada **levantamento_item** pode ter o campo **sla_horas**. Ele é usado para:

- Mostrar no **mapa** e no **painel de detalhes** do ponto (ex.: “SLA 24h”).
- Estatísticas no painel do mapa (safe / warning / danger por faixa de SLA).
- Relatórios PDF (coluna SLA).

A **origem** desse `sla_horas` (cálculo na importação, regra fixa, ou integração com sla_config) depende da lógica de negócio do seu projeto; o frontend apenas exibe e filtra por ele.

---

## Onde está no código (referência rápida)

- **Tipos:** `src/types/sla.ts` (SlaOperacional, status, regras, getSlaVisualStatus, getTempoRestante).
- **Config:** `src/types/sla-config.ts`, `src/components/sla/SlaConfigTab.tsx`.
- **Páginas:** `src/pages/Operador.tsx` (SLA Operacional), `src/pages/admin/AdminSla.tsx` (Gestão de SLA).
- **Alertas:** `src/hooks/useSlaAlerts.ts`, `src/components/SlaAlertBell.tsx`.
- **Dashboard:** `src/components/dashboard/SlaWidget.tsx`, `src/components/dashboard/OperacionalWidget.tsx` (“Atualizar SLA” → vai para `/operador`).
- **Exportação:** `src/lib/slaPdf.ts`, `src/lib/slaAuditPdf.ts`.

---

## Status do fluxo na aplicação

**Resposta direta:** o fluxo está **só em parte** implementado no repositório.

### O que está implementado e funciona (se as tabelas existirem)

| Parte | Status |
|-------|--------|
| **Telas** | ✅ **SLA Operacional** (`/operador`) e **Gestão de SLA** (`/admin/sla`) existem e fazem SELECT/UPDATE em `sla_operacional`. |
| **Configuração** | ✅ **sla_config** é lida e salva na aba Configuração da Gestão de SLA (com fallback se a tabela não existir). |
| **Ações** | ✅ Assumir, Concluir, atribuir operador e forçar status estão no código e atualizam `sla_operacional`. |
| **Alertas** | ✅ **useSlaAlerts** e **SlaAlertBell** consultam `sla_operacional` e disparam toasts/notificações. |
| **Dashboard e PDF** | ✅ SlaWidget, SlaEvolutionChart e exportação PDF usam `sla_operacional`. |

Ou seja: toda a **leitura e atualização** de SLA está implementada no frontend.

### O que não está no repositório

| Parte | Status |
|-------|--------|
| **Tabelas no Supabase** | ⚠️ Não há migração neste repo que crie **sla_operacional** nem **sla_config**. Elas podem ter sido criadas no painel do Supabase ou em outro projeto. Se não existirem, as telas e o sino vão falhar ao carregar. |
| **Criação dos SLAs** | ❌ Não existe **nenhum `INSERT` em `sla_operacional`** no código (nem no frontend nem em migrations). Ou seja, o passo “gerar registros em `sla_operacional` a partir de `pluvio_operacional_item`” **não está implementado** aqui. Se nada externo (trigger, Edge Function, job) fizer isso, a lista de SLA Operacional ficará sempre vazia. |

### Conclusão

- **Se** as tabelas `sla_operacional` e `sla_config` existirem no banco e **algo** (fora deste repo) já insere linhas em `sla_operacional`, então: **sim**, o fluxo de uso (ver lista, assumir, concluir, alertas, config, PDF) está funcionando na aplicação.
- **Se** as tabelas não existirem ou **nenhum** processo criar registros em `sla_operacional`, então: a aplicação até “funciona”, mas a lista de SLA ficará vazia e o fluxo operacional não acontece na prática.

Para o fluxo ficar **completo** neste projeto, seria necessário:

1. **Migração** que crie as tabelas `sla_operacional` e `sla_config` (e RLS, se ainda não existir).
2. **Alguma forma de gerar SLAs** a partir dos itens pluviométricos (ex.: função no Supabase chamada ao finalizar um run, ou botão “Gerar SLAs” na Gestão de SLA que chame um endpoint e insira em `sla_operacional`).

**Implementação feita:** Foi criada a migração `supabase/migrations/20250303000000_sla_operacional_gerar_e_rls.sql` (RLS + função `gerar_slas_para_run`) e o card **"Gerar SLAs"** na aba Gestão de SLA. Basta aplicar a migração no Supabase, escolher o run e clicar em **Gerar SLAs** para popular `sla_operacional` a partir dos itens pluviométricos.
