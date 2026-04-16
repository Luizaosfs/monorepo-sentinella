# SLA — Sequência passo a passo

Este documento descreve a sequência para deixar o SLA operacional funcional na aplicação Sentinella Map.

---

## Visão geral

1. Aplicar a migração SQL no Supabase (RLS + função de geração).
2. Garantir que exista run pluviométrico para o cliente.
3. Gerar os SLAs a partir do run na tela Gestão de SLA.
4. Usar as telas SLA Operacional, alertas e relatórios.

---

## Passo 1 — Aplicar a migração no Supabase

**O que fazer:** Executar o SQL da migração que cria as políticas RLS e a função que gera os registros de SLA.

**Arquivo:** `supabase/migrations/20250303000000_sla_operacional_gerar_e_rls.sql`

**Como:**

- **Opção A (SQL Editor):** No painel do Supabase, abra **SQL Editor**, cole todo o conteúdo do arquivo e execute.
- **Opção B (CLI):** No projeto, rode `supabase db push` (ou `supabase migration up`) se estiver usando Supabase CLI.

**Resultado esperado:** Execução sem erro. Ficam ativos:

- RLS em `sla_config`, `sla_config_audit` e `sla_operacional`.
- Função `gerar_slas_para_run(p_run_id uuid)`.
- Funções auxiliares `sla_horas_from_config` e `sla_aplicar_fatores`.

---

## Passo 2 — Ter run pluviométrico para o cliente

**O que é:** Um *run* é uma rodada de análise pluviométrica por cliente. Cada run tem vários *itens* (bairros/regiões) com prioridade e risco. Esses itens são a base para criar os SLAs.

**Tabelas envolvidas:**

- `pluvio_operacional_run` — uma linha por run (cliente, data de referência).
- `pluvio_operacional_item` — uma linha por bairro/região do run (prioridade, classificação de risco, etc.).

**Como ter um run:**

1. Acesse **Cadastros → Pluviometria → Tabela operacional**.
2. Importe ou processe os dados para o cliente conforme o fluxo da aplicação (data de referência + arquivo/importação).
3. Confirme no banco ou na tela que existem registros em `pluvio_operacional_run` e `pluvio_operacional_item` para o cliente.

**Se não houver run:** O select de runs na Gestão de SLA ficará vazio e não será possível gerar SLAs até que exista ao menos um run com itens.

---

## Passo 3 — Gerar os SLAs na aplicação

**Onde:** **Gestão de SLA** (menu Cadastros) → aba **Gestão**.

**Sequência:**

1. Se for **admin**, selecione o **cliente** no seletor "Cliente ativo" (canto superior).
2. Na aba **Gestão**, localize o card **"Gerar SLAs a partir de run pluviométrico"**.
3. No **select**, escolha o **run** pela data (ex.: 01/03/2025). A lista é ordenada da data mais recente para a mais antiga.
4. Clique no botão **"Gerar SLAs"**.
5. Aguarde o processamento (alguns segundos).

**Resultado esperado:**

- Toast de sucesso: **"X SLA(s) criado(s) com sucesso"** (X = quantidade de itens do run que ainda não tinham SLA aberto).
- Ou: **"Nenhum item novo para gerar SLA (todos já possuem SLA aberto)."** — isso é normal se você já tiver gerado para esse run antes.
- A lista de SLAs na mesma aba deve ser atualizada e passar a exibir os novos registros (bairro, prioridade, SLA em horas, prazo, status, operador).

**Observação:** A função só cria SLA para itens que *ainda não* possuem um SLA em status **pendente** ou **em_atendimento**. Itens já com SLA aberto são ignorados para não duplicar.

---

## Passo 4 — Usar o SLA no dia a dia

Após gerar os SLAs, o fluxo fica disponível nas demais telas:

| Onde | O que fazer |
|------|-------------|
| **SLA Operacional** (`/operador`) | Ver a lista de SLAs do cliente (operador vê só os atribuídos a ele). **Assumir** (pendente → em atendimento) e **Concluir**. Ver tempo restante ou "Vencido". |
| **Sino de alertas** (ícone no layout) | Abrir o painel com SLAs próximos do vencimento ou vencidos; notificações em tempo real (toast e navegador) conforme `useSlaAlerts`. |
| **Dashboard** | Widget "SLA Operacional" com totais e itens urgentes. |
| **Gestão de SLA** | Atribuir **operador** a um SLA, forçar status (Concluir/Vencido), ver **ranking** de operadores, **Exportar PDF**, abas **Configuração** e **Histórico**. |

---

## Configuração opcional (horas por prioridade)

Em **Gestão de SLA → Configuração** é possível ajustar:

- **Horas por prioridade** (ex.: Crítica 4h, Alta 12h, Baixa 72h).
- **Fatores de redução** (risco "Muito Alto", persistência, temperatura).
- **Horário comercial** (contar prazo só em certo período).

Essa config é usada na **próxima** vez que você clicar em **Gerar SLAs**; os SLAs já existentes não são recalculados. Para um run novo, basta escolher o run e clicar em **Gerar SLAs** de novo.

---

## Resumo da sequência

```
1. Rodar migração SQL (Supabase)
        ↓
2. Ter run pluviométrico (Tabela operacional / importação)
        ↓
3. Gestão de SLA → Gestão → Selecionar run → "Gerar SLAs"
        ↓
4. SLA Operacional, alertas, dashboard e relatórios passam a usar os dados
```

---

## Referências

- **Contexto e fluxo completo:** `docs/SLA-CONTEXTO-E-FLUXO.md`
- **Migração:** `supabase/migrations/20250303000000_sla_operacional_gerar_e_rls.sql`
- **Tipos e regras no código:** `src/types/sla.ts`, `src/types/sla-config.ts`
