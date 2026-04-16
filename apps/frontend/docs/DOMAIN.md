# DOMAIN.md — SentinelaWeb

Documento de referência do domínio de negócio da aplicação. Descreve entidades, fluxos, regras e decisões de design que guiam o desenvolvimento.

---

## Visão geral

O **Sentinella Map** é uma plataforma SaaS para prefeituras e equipes de vigilância monitorarem e tratarem possíveis focos de dengue. Combina levantamentos em campo (manual ou por drone), análise automática de imagens via IA, gestão de SLA operacional e acompanhamento de ações corretivas — tudo com rastreabilidade completa por cliente (prefeitura).

---

## Públicos e papéis

| Papel | Acesso |
|-------|--------|
| **admin** | Acesso total ao sistema; gerencia clientes, usuários e configurações globais |
| **supervisor** | Admin do cliente; vê todos os dados do cliente ativo |
| **usuario** | Acesso geral às telas do cliente (dashboard, mapa, levantamentos) |
| **operador** | Portal próprio (`/operador/*`); acessa apenas meus itens, mapa e criação manual |

RBAC via RPC `get_meu_papel` no Supabase. Admin pode trocar o cliente ativo via `ClienteAtivoProvider`.

---

## Entidades do domínio

### Cliente
Normalmente uma prefeitura. Raiz de multitenancy — toda entidade do sistema possui `cliente_id`. Ao criar um cliente, seeds automáticos criam:
- `sentinela_risk_policy` (política de risco pluviométrico)
- `sentinela_drone_risk_config` + `sentinela_yolo_class_config` (risco e mapa de classes YOLO para drone)
- `sla_config` (configuração de SLA operacional)

### Região / Bairro
Estruturas geográficas cadastradas para organizar planejamentos. Uma região pertence a um cliente e possui coordenadas geográficas e área.

### Planejamento
Organização da atividade de campo. Pertence a um cliente e a uma região/bairro. Tipos:
- **DRONE** — voo autônomo com captura de imagens
- **MANUAL** — vistoria humana em campo

Campo `ativo` controla se novos levantamentos/itens podem ser criados.

### Levantamento
Execução prática ligada a um planejamento. Representa o conjunto de evidências de um dia/tipo. Regra: **um levantamento por (cliente, planejamento, data, tipo)**. Criado automaticamente ao inserir o primeiro item via `criar_levantamento_item_manual`.

Campos relevantes: `titulo`, `data_voo`, `total_itens`, `tipo_entrada` (DRONE | MANUAL), `cliente_id`, `planejamento_id`.

### Levantamento Item
Cada problema, foco ou evidência dentro de um levantamento. É a unidade de trabalho do operador.

Campos relevantes: `item` (nome/tipo), `risco` (alto | medio | baixo), `prioridade`, `sla_horas`, `score_final`, `latitude`, `longitude`, `endereco_curto`, `endereco_completo`, `image_url` (Cloudinary), `status_atendimento`, `acao_aplicada`, `data_hora`.

Ao ser inserido, um trigger cria automaticamente um registro em `sla_operacional`.

### Operação
Registro de atendimento de campo ligado a um item. Pode referenciar um `item_operacional_id` (item pluviométrico) ou um `item_levantamento_id` (levantamento item). Status: `pendente → em_andamento → concluido`. Ao concluir, trigger fecha o `sla_operacional` correspondente.

### Operador
Usuário com papel `operador`. Acessa o portal `/operador/*` e vê apenas seus itens e SLAs atribuídos.

---

## Fontes de dados

### Drone (Python + YOLO + ExifTool)
Pipeline externo em Python:
1. Voo executado pelo módulo Sentinela (Python)
2. Captura de imagens
3. Extração de metadados EXIF via ExifTool
4. Detecção de problemas via YOLO (`sentinela_yolo_class_config`)
5. Refinamento de risco (`sentinela_drone_risk_config`)
6. Upload de imagens para Cloudinary
7. INSERT em `levantamento_itens` via `criar_levantamento_item_manual`

### Manual (operador em campo)
O operador usa a tela **Criar item manual** (`/operador/levantamentos/novo-item`) ou a tela de levantamentos para registrar ocorrências diretamente. A RPC `criar_levantamento_item_manual` valida o planejamento, verifica limite diário e cria/reutiliza o levantamento do dia.

### Pluviometria (análise climática)
O módulo Python também executa análise pluviométrica por região:
- `pluvio_operacional_run` — uma rodada de análise por cliente/data
- `pluvio_operacional_item` — cada bairro/região na rodada, com `classificacao_risco`, `prioridade_operacional`, `persistencia_7d`, `temp_media_c`, `chuva_24h_mm`

Esses dados alimentam o **SLA Operacional** e o **Risco Pluviométrico**.

---

## SLA — dois contextos

### 1. SLA Operacional (pluvio)
Rastreia o prazo de **intervenção por bairro** a partir de dados pluviométricos.

**Tabela principal:** `sla_operacional`

| Campo | Descrição |
|-------|-----------|
| `item_id` | FK para `pluvio_operacional_item` (nullable desde M13) |
| `levantamento_item_id` | FK para `levantamento_itens` (nullable, mutuamente exclusivo com item_id) |
| `cliente_id` | Denormalizado para RLS e filtros eficientes |
| `prioridade` | Crítica / Urgente / Alta / Média / Baixa / Monitoramento |
| `sla_horas` | Prazo calculado em horas |
| `inicio` / `prazo_final` | Janela de atendimento |
| `status` | `pendente → em_atendimento → concluido / vencido` |
| `violado` | true se concluído após o prazo ou marcado vencido |
| `escalonado` / `prioridade_original` | Quando a prioridade foi elevada automaticamente |

**Como os SLAs são criados:**
- **Pluvio:** trigger `trg_after_insert_pluvio_item_sla` no INSERT de `pluvio_operacional_item` — ou manualmente via "Gerar SLAs" (RPC `gerar_slas_para_run`)
- **Levantamento:** trigger `trg_after_insert_levantamento_item_sla` no INSERT de `levantamento_itens`

**Configuração por cliente (`sla_config`):**
- Horas por prioridade (ex.: Urgente = 4h, Alta = 12h, Baixa = 72h)
- Fatores de redução: risco "Muito Alto" (-30%), persistência de chuva > N dias (-20%), temperatura > 30°C (-10%)
- Horário comercial (opcional): SLA só conta no expediente

**Ciclo de vida:**
1. SLA criado com `status = pendente`
2. Operador assume → `em_atendimento`
3. Operador conclui ou operação é fechada → `concluido` (grava `concluido_em`; se passou do prazo, `violado = true`)
4. Prazo expirado sem conclusão → `vencido` (via Edge Function `sla-marcar-vencidos` a cada 15min ou `useSlaAlerts` a cada 1min)
5. Admin pode **escalar** (eleva prioridade e recalcula prazo via `escalar_sla_operacional`) ou **reabrir** (volta para pendente)

**Auditoria:** Alterações em `sla_config` são registradas em `sla_config_audit` via trigger.

### 2. SLA no Mapa (levantamento_itens)
Simples: campo `sla_horas` em cada `levantamento_item`. Usado para exibir prazo no mapa e calcular status visual (seguro / alerta / vencido) com base em `data_hora + sla_horas`.

---

## Risco pluviométrico

Política configurável por cliente via tabela `sentinela_risk_policy` (e tabelas filhas). Define:
- Bins de chuva (ex.: 0–10mm = baixo, 10–30mm = médio)
- Fatores de temperatura e vento
- Thresholds de classificação final

Resultado: `classificacao_risco` e `prioridade_operacional` em cada `pluvio_operacional_item`.

---

## Risco DRONE / YOLO

Política configurada por cliente via:
- `sentinela_drone_risk_config` — scoring base por risco, thresholds, sla por prioridade
- `sentinela_yolo_class_config` — mapa de classes YOLO (item_key → item, risco, peso, ação)
- `sentinela_yolo_synonym` — sinônimos de classes YOLO

O pipeline Python consulta essas tabelas ao processar as imagens do voo. Fallback para JSONs locais se Supabase indisponível.

---

## Rastreabilidade

Todo item rastreável mantém a cadeia:

```
cliente → planejamento → levantamento → levantamento_item → operacao → evidencia
                                                          ↘ sla_operacional
pluvio_run → pluvio_item → sla_operacional → operacao
```

Regras:
- Imagens armazenadas no Cloudinary com vínculo em `levantamento_itens.image_url`
- Toda operação referencia o item (pluvio ou levantamento)
- Toda análise automática pode ser auditada (YOLO class config, risco, score)

---

## Regras de negócio importantes

| Regra | Onde |
|-------|------|
| 1 levantamento por (cliente, planejamento, data, tipo) | `criar_levantamento_item_manual` / constraint unique |
| Limite de itens manuais por dia por planejamento | `levantamento_item_manual_regra` (configurável por cliente) |
| Operador só acessa dados do próprio cliente | RLS + `usuario_pode_acessar_cliente` |
| SLA exatamente um FK: `item_id` OU `levantamento_item_id` | constraint `sla_operacional_item_exclusivo` |
| SLA não pode ser escalado se já estiver concluído | validação em `escalar_sla_operacional` |
| Operação concluída fecha SLA correspondente | trigger `trg_operacoes_on_status_concluido` |
| Seeds automáticos ao criar cliente | trigger + functions + frontend seeds |

---

## Fluxo operacional resumido

### Drone
```
Planejamento criado → Voo Python → YOLO → levantamento_item INSERT
  → trigger cria sla_operacional (pendente)
  → Operador vê item no mapa/lista
  → Operador assume → cria operação (em_andamento)
  → Operador conclui → operação concluída → trigger fecha sla_operacional
```

### Manual
```
Planejamento criado → Operador abre app → Cria item manual (formulário)
  → criar_levantamento_item_manual INSERT → trigger cria sla_operacional (pendente)
  → Mesmo fluxo de atendimento acima
```

### Pluvio
```
Run pluviométrico (Python) → pluvio_operacional_item INSERT
  → trigger cria sla_operacional (pendente)
  → Admin atribui operador em Gestão de SLA
  → Operador assume/conclui em SLA Operacional (/operador)
  → sla_operacional fechado
```

---

## Alertas e notificações

- **`useSlaAlerts`** — poll a cada 1 min: chama `marcar_slas_vencidos`, busca SLAs urgentes/vencidos/escalados e dispara toasts + notificações do navegador
- **`SlaAlertBell`** — sino no header com badge de contagem; abre painel lateral com SLAs críticos
- **Edge Function `sla-marcar-vencidos`** — agendada a cada 15min no Supabase; marca `status = vencido` nos SLAs expirados de todos os clientes

---

## Telas principais

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard — widgets de KPI, SLA, pluvio, operações, mapa |
| `/mapa` | Mapa de inspeção com heatmap, clusters, filtros |
| `/levantamentos` | Lista de levantamentos do cliente |
| `/operador` | SLA Operacional — lista de SLAs do operador |
| `/operador/mapa` | Mapa do operador com pontos atribuídos |
| `/operador/levantamentos` | Meus itens (filtrados por operador) |
| `/operador/levantamentos/novo-item` | Criar item manual |
| `/admin/clientes` | CRUD de clientes (admin only) |
| `/admin/usuarios` | Gestão de usuários do cliente |
| `/admin/planejamentos` | Gestão de planejamentos |
| `/admin/regioes` | Regiões e bairros |
| `/admin/sla` | Gestão de SLA (lista, config, ranking, auditoria) |
| `/admin/operacoes` | Operações de campo |
| `/admin/historico-atendimento` | Histórico por localização + pontos recorrentes |
| `/admin/pluvio-risco` | Risco pluviométrico por bairro |
| `/admin/pluvio-operacional` | Tabela operacional pluviométrica |
| `/admin/risk-policy` | Configuração da política de risco pluvio + YOLO |
| `/admin/voos` | Histórico de voos com drone |

---

## Migrations aplicadas (ordem)

| Arquivo | O que faz |
|---------|-----------|
| `20250301` | Permite `auth_id` nulo em `usuarios` |
| `20250302` | RLS em regiões e tabelas gerais |
| `20250303` | RLS + funções SLA (`gerar_slas_para_run`, `sla_horas_from_config`, `sla_aplicar_fatores`) |
| `20250306_100` | Evidências de atendimento + `tipo_entrada` em levantamentos |
| `20250306_110` | Trigger operações → fecha SLA ao concluir |
| `20250306_120` | RLS operações e evidências |
| `20250306_130` | View `v_historico_atendimento_local` |
| `20250306_140` | RPC `get_meu_papel` |
| `20250306_150` | RLS papéis/usuários |
| `20250306_170` | Regra de limite de itens manuais por dia |
| `20250307_100` | `tipo_levantamento` em planejamento |
| `20250307_120` | Evidências por item de levantamento |
| `20250307_140` | Observação e atendimento em levantamento_itens |
| `20250307_160` | `status_atendimento` em levantamento_itens |
| `20250308_120` | Constraint 1 levantamento por dia |
| `20250308_150` | `criar_levantamento_item_manual` calcula SLA via `sla_config` |
| `20250309_100` | Trigger auto-SLA ao inserir `pluvio_operacional_item` |
| `20250309_110` | `marcar_slas_vencidos` + `escalar_sla_operacional` + `escalar_prioridade` |
| `20250309_120` | Tabela `sla_config_audit` + trigger de auditoria |
| `20250309_130` | `sla_operacional` suporta `levantamento_item_id`; trigger auto-SLA em `levantamento_itens`; RLS via `cliente_id` direto |

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite + shadcn/ui + Tailwind CSS |
| Estado servidor | @tanstack/react-query |
| Roteamento | React Router v6 |
| Mapas | Leaflet + react-leaflet (heatmap + cluster) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Armazenamento de imagens | Cloudinary |
| Processamento drone | Python (ExifTool + YOLO) |
| PWA | Workbox via vite-plugin-pwa |
