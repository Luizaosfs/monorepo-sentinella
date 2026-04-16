# 05 — Banco de Dados

> **Para quem é este documento:** desenvolvedores e DBAs que precisam entender a modelagem do banco, a timeline de migrations, os relacionamentos entre entidades e os pontos de atenção na estrutura atual.

---

## Visão geral

O banco de dados é PostgreSQL, gerenciado pelo Supabase. Toda a estrutura é definida por migrations SQL versionadas em `supabase/migrations/`. Até a análise (julho de 2026), foram aplicadas **87+ migrations**, com duas fases distintas:

- **Fase 1 (março–março 2025):** fundação do sistema — clientes, planejamentos, levantamentos, SLA, operações, vistoria, casos notificados, CNES
- **Fase 2 (março 2026–julho 2026):** consolidação — patches de RLS, quota enforcement, renomeações LGPD, LIRAa, quarteirões, e a maior mudança arquitetural: `focos_risco` como aggregate root

---

## Timeline de migrations

### Fase 1 — março de 2025

| Migration | O que faz |
|-----------|-----------|
| `20250301000000` | Permite `auth_id` nulo em `usuarios` |
| `20250302000000` | RLS de regiões + função `usuario_pode_acessar_cliente` |
| `20250302100000` | RLS geral de todas as tabelas principais; funções `is_admin`, `usuario_cliente_id` |
| `20250303000000` | `sla_operacional` + funções `sla_horas_from_config`, `sla_aplicar_fatores`, `gerar_slas_para_run` |
| `20250306000000` | RLS de operadores e gestão de usuários; `is_operador()` |
| `20250306100000` | `operacao_evidencias` + tipo_entrada em levantamentos |
| `20250306110000` | Trigger `trg_operacao_concluida_sla` (fecha SLA ao concluir operação) |
| `20250306120000` | RLS de `operacoes` e `evidencias` |
| `20250306130000` | View `v_historico_atendimento_local` |
| `20250306140000` | RPC `get_meu_papel` (SECURITY DEFINER) |
| `20250306150000` | Policy de select próprio em `papeis_usuarios` |
| `20250306160000` | **Seed de operador dev** (risco: usuário de dev possivelmente em produção) |
| `20250306170000` | `tags`, `levantamento_item_tags`; regra de item manual |
| `20250307100000` | Tipo de levantamento no planejamento |
| `20250307120000` | `levantamento_item_evidencias` |
| `20250307140000` | Campo `observacao_atendimento` em `levantamento_itens` |
| `20250307160000` | Campo `status_atendimento` em `levantamento_itens` (depois removido) |
| `20250308120000` | Sprint 4 — múltiplas adições |
| `20250309100000` | SLA automático para itens pluvio |
| `20250309110000` | SLA escalamento e vencidos |
| `20250309120000` | `sla_config_audit` |
| `20250309130000` | Trigger de SLA para `levantamento_item` |
| `20250311100000` | `levantamento_item_status_historico` |
| `20250311110000` | `plano_acao_catalogo` |
| `20250311120000` | `levantamento_item_recorrencia` + `levantamento_item_recorrencia_itens` |
| `20250311130000` | SLA com feriados e horário comercial |
| `20250311180000` | Config de SLA por região |
| `20250318000000` | `unidades_saude`, `casos_notificados`, `caso_foco_cruzamento` + trigger `trg_cruzar_caso_focos` |
| `20250318001000` | `imoveis`, `vistorias`, `vistoria_depositos`, `vistoria_sintomas`, `vistoria_riscos` + trigger `trg_sintomas_para_caso` |
| `20250318002000` | Colunas de acesso em `imoveis`/`vistorias`; `vistoria_calhas`; view `v_imovel_historico_acesso`; trigger `trg_atualizar_perfil_imovel` |
| `20250318003000` | Integração e-SUS Notifica: `cliente_integracoes`, `item_notificacoes_esus` |
| `20250319000000` | CNES sync: `unidades_saude_sync_controle`, `unidades_saude_sync_log` |

### Fase 2 — março a julho de 2026

| Migration | O que faz |
|-----------|-----------|
| `20260319225500` | Fix trigger `trg_sintomas_para_caso` (unidade_saude) |
| `20260319233000` | Fix RLS vistoria multitenancy para admin |
| `20260319240000` | Índices de performance |
| `20260319241000` | Trigger `trg_quota_enforcement` |
| `20260319242000` | Renomeação LGPD: `nome_paciente` → removido |
| `20260320001000` | Papel `notificador` na aplicação |
| `20260326133000` | Fix visibilidade de operadores entre si |
| `20260326143000` | Fix RLS de supervisor em `papeis_usuarios` |
| `20260326170000` | Fix grant RPC para denuncia autenticada |
| `20260326173000` | Fix `canal_cidadao_denunciar` RPC |
| `20260605020000` | Fix caso descartado, SLA D02/D03/E02 |
| `20260605030000` | RLS do notificador (D05) |
| `20260605040000` | Quota com timezone (F01) |
| `20260606000000` | Seed YOLO: piscina_limpa, caixa_fechada |
| `20260606100000` | Trigger SLA apenas para prioridades P1/P2/P3 |
| `20260607000000` | Fix SECURITY DEFINER em views |
| `20260608000000` | `detection_bbox` em `levantamento_itens` |
| `20260608100000` | `levantamento_item_detecoes` (múltiplas detecções por item) |
| `20260609000000` | Fix RLS de `unidades_saude` para admin |
| `20260701000000` | `platform_admin` (papel de plataforma) |
| `20260702000000` | Revert: `platform_admin` → `admin` |
| `20260710000000` | **`focos_risco` Fase 1** — tabela principal, RLS, índices GIST, triggers, view, RPC |
| `20260710010000` | `focos_risco` sync SLA timeline |
| `20260710020000` | `focos_risco` backfill e cleanup |
| `20260710030000` | `focos_risco` dados epidemiológicos auxiliares |
| `20260710040000` | `focos_risco` integração LIRAa |
| `20260710050000` | `focos_risco` gaps (campos faltantes) |
| `20260710060000` | Fix view timeline |
| `20260711000000` | **DROP das colunas legadas de `levantamento_itens`** |
| `20260712000000` | Backfill final: `foco_risco_id` em `levantamento_itens` existentes |
| `20260713000000` | Idempotência de vistoria offline (QW-05) |
| `20260714000000` | `sla_erros_criacao` + `reabrir_sla()` recalcula prazo (QW-06) |
| `20260715000000` | `escalado_por`/`reaberto_por` em `sla_operacional`; `origem_offline` em `vistorias`; `updated_by` em `levantamento_itens` + trigger (QW-07) |
| `20260716000000` | **QW-08**: substitui índices GIST geometry → geography em `levantamento_itens` e `casos_notificados`; adiciona GIST em `imoveis` |

---

## Tabelas principais e seus relacionamentos

### Hierarquia de dados

```
clientes (prefeitura)
  ├── usuarios (membros da equipe)
  ├── regioes → bairros
  ├── planejamentos → levantamentos → levantamento_itens
  │                                      └── focos_risco ← aggregate root
  │                                            ├── foco_risco_historico
  │                                            └── sla_operacional
  ├── imoveis → vistorias
  │                ├── vistoria_depositos
  │                ├── vistoria_sintomas → casos_notificados
  │                ├── vistoria_riscos
  │                └── vistoria_calhas
  ├── unidades_saude → casos_notificados
  │                       └── caso_foco_cruzamento → focos_risco
  └── canal_cidadao → focos_risco (origem: cidadao)
```

---

## Catálogo completo de tabelas

### Entidades de configuração e identidade

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `clientes` | Prefeituras | Raiz do multitenancy. Campos `uf`, `ibge_municipio` necessários para CNES sync |
| `usuarios` | Membros da equipe | `auth_id` pode ser null (convite pendente) |
| `papeis_usuarios` | Papel por usuário | `admin`, `supervisor`, `usuario`, `operador`, `notificador` |
| `regioes` | Regiões geográficas | Hierarquia: região → bairros |

### Entidades de planejamento e levantamento

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `planejamentos` | Planos de operação | Tipo: `DRONE` ou `MANUAL` |
| `levantamentos` | Execuções de planejamento | 1 por dia por planejamento |
| `levantamento_itens` | Focos/evidências identificados | **Imutável após criado.** Colunas de atendimento foram removidas em `20260711000000` |
| `levantamento_item_evidencias` | Fotos vinculadas a itens | URL Cloudinary + metadados |
| `levantamento_item_detecoes` | Múltiplas detecções YOLO por item | Adicionado em `20260608100000` |
| `levantamento_item_status_historico` | Histórico legado de status | Substituído por `foco_risco_historico` |
| `levantamento_item_recorrencia` | Agrupamento de recorrências | |
| `levantamento_item_recorrencia_itens` | Itens em uma recorrência | |
| `levantamento_analise_ia` | Sumário da triagem IA pós-voo | Gerado pela Edge Function `triagem-ia-pos-voo` |
| `tags` | Tags para itens | |
| `levantamento_item_tags` | Relação N:N item↔tag | |

### Entidades do ciclo operacional (aggregate root)

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `focos_risco` | **Entidade central do sistema** | 7 estados, 5 origens, PostGIS GIST index |
| `foco_risco_historico` | Ledger imutável de transições | Append-only, nunca alterar |

### Entidades de SLA

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `sla_operacional` | Prazo de atendimento por foco | Criado por trigger; fechado por operação |
| `sla_config_regiao` | Config de SLA por região | Override por área geográfica |
| `sla_feriados` | Feriados locais | Considerados no cálculo de prazo comercial |
| `sla_config_audit` | Auditoria de mudanças na config | |

### Entidades de campo (vistoria domiciliar)

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `imoveis` | Edificações visitáveis | Colunas de perfil: prioridade_drone, tem_calha, etc. |
| `vistorias` | Visitas de agentes a imóveis | Colunas de acesso: `acesso_realizado`, `motivo_sem_acesso` |
| `vistoria_depositos` | Depósitos PNCD por vistoria (A1–E) | Upsert por vistoria_id + tipo |
| `vistoria_sintomas` | Sintomas declarados pelos moradores | Trigger cria `caso_notificado` se `moradores_sintomas_qtd > 0` |
| `vistoria_riscos` | Riscos sociais, sanitários, vetoriais | |
| `vistoria_calhas` | Calhas inspecionadas por posição/condição | |

### Entidades de casos e notificações

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `casos_notificados` | Casos de dengue registrados por UBS/UPA | **Sem PII** (LGPD). Trigger cruza com focos em 300m |
| `caso_foco_cruzamento` | Vínculo automático caso↔foco | Preenchido só pelo trigger |
| `unidades_saude` | UBS, UPA, hospitais | Sync com CNES. Campo `origem='manual'` nunca é inativado |
| `unidades_saude_sync_controle` | Status da sincronização CNES | Uma linha por cliente |
| `unidades_saude_sync_log` | Log linha a linha do CNES sync | |

### Entidades de canal cidadão

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `canal_cidadao` | Denúncias públicas via QR code | Inserção via RPC `canal_cidadao_denunciar` (SECURITY DEFINER) |

### Entidades de integração

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `cliente_integracoes` | Config e-SUS Notifica por cliente | API key, IBGE, CNES, ambiente |
| `item_notificacoes_esus` | Histórico de envios ao e-SUS | |

### Entidades de drone e voo

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `drones` | Cadastro de drones | |
| `voos` | Registros de voos realizados | |
| `yolo_feedback` | Feedbacks de falso positivo | |
| `yolo_class_config` | Config de classes YOLO por cliente | Thresholds por tipo de detecção |
| `drone_risk_config` | Config de risco do drone | `base_by_risco`, `priority_thresholds` |

### Entidades de risco pluvial

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `pluvio_risco_runs` | Execuções do cálculo diário de risco | |
| `pluvio_risco_bairros` | Score de risco por bairro | |
| `risk_policies` | Políticas de risco configuráveis | Variáveis: chuva, temperatura, vento, persistência |

### Entidades de LIRAa e quarteirões

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `liraa_ciclos` | Ciclos LIRAa por cliente | |
| `liraa_amostras` | Amostras coletadas | |
| `quarteiroes` | Quarteirões por região | |
| `distribuicao_quarteirao` | Atribuição de agentes por quarteirão | |

### Entidades de quotas e infraestrutura

| Tabela | Descrição | Notas |
|--------|-----------|-------|
| `quotas` | Limites de uso por cliente | |
| `push_subscriptions` | Subscrições Web Push por usuário | |
| `resumos_diarios` | Resumo diário de atividade | |
| `operacao_evidencias` | Evidências fotográficas de operações | |

---

## A tabela `focos_risco` em detalhe

A migration `20260710000000` é a mais significativa do sistema. A tabela tem:

```sql
CREATE TABLE focos_risco (
  id                uuid        PRIMARY KEY,
  cliente_id        uuid        NOT NULL REFERENCES clientes(id),
  imovel_id         uuid        REFERENCES imoveis(id),
  regiao_id         uuid        REFERENCES regioes(id),
  levantamento_item_id  uuid    REFERENCES levantamento_itens(id),

  -- State machine
  status            text        NOT NULL DEFAULT 'suspeita'
    CHECK (status IN ('suspeita','em_triagem','aguarda_inspecao',
                      'confirmado','em_tratamento','resolvido','descartado')),
  origem            text        NOT NULL
    CHECK (origem IN ('drone','agente','cidadao','pluvio','manual')),
  prioridade        text        DEFAULT 'P3',

  -- Geolocalização
  latitude          numeric,
  longitude         numeric,
  endereco_normalizado text,

  -- Responsável e resolução
  responsavel_id    uuid        REFERENCES usuarios(id),
  confirmado_em     timestamptz,  -- início do SLA
  resolvido_em      timestamptz,
  desfecho          text,

  -- Recorrência
  foco_anterior_id  uuid        REFERENCES focos_risco(id),

  -- Cruzamento com casos
  casos_ids         uuid[]      NOT NULL DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

**Índice PostGIS:**
```sql
CREATE INDEX ON focos_risco
  USING GIST (geography(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)));
```

**Transições de estado válidas** (CHECK + trigger de validação):
```
suspeita → em_triagem
em_triagem → aguarda_inspecao | descartado
aguarda_inspecao → confirmado | descartado
confirmado → em_tratamento
em_tratamento → resolvido | descartado
```

---

## Views

| View | O que retorna | Notas |
|------|---------------|-------|
| `v_focos_risco_ativos` | Focos com status ≠ resolvido/descartado + joins | Paginável. Usada por `api.focosRisco.list()` |
| `v_imovel_historico_acesso` | Histórico de tentativas por imóvel (% sem acesso, requer notificação) | Somente leitura — nunca inserir manualmente |
| `v_historico_atendimento_local` | Timeline de atendimentos por localização | View legada |

---

## Índices relevantes

### Índices espaciais (GIST geography)

Todas as queries ST_DWithin usam `::geography` — índices devem ser `GIST(expression::geography)` para serem usados pelo planner.

| Tabela | Índice | Migração | Uso |
|---|---|---|---|
| `focos_risco` | `idx_focos_risco_geo` | `20260710000000` | ST_DWithin em fn_cruzar_foco_novo_com_casos, fn_vincular_imovel |
| `levantamento_itens` | `idx_levantamento_itens_geo` | `20260716000000` (substitui geometry) | ST_DWithin em fn_cruzar_caso_com_focos, RPC listar_casos_no_raio |
| `casos_notificados` | `idx_casos_notificados_geo` | `20260716000000` (substitui geometry) | ST_DWithin em trigger e RPC |
| `imoveis` | `idx_imoveis_geo` | `20260716000000` (novo) | ST_DWithin em fn_vincular_imovel_automatico (raio 30m) |

> **Atenção:** Os índices criados em `20260319240000` e `20260604000000` eram do tipo geometry e eram invisíveis ao planner PostgreSQL quando as queries usam `::geography`. A migration `20260716000000` corrigiu isso via DROP + CREATE com o tipo correto. (QW-08)

### Outros índices relevantes

Além dos GIST:
- Índices em `cliente_id` de todas as tabelas (obrigatório por padrão — multitenancy)
- Índice `(cliente_id, cnes)` UNIQUE em `unidades_saude`
- Índice B-tree `(cliente_id, latitude, longitude)` em `casos_notificados` (mantido para filtros não-espaciais)

---

## Campos redundantes e fontes de verdade conflitantes

### 1. Status de atendimento: `levantamento_itens` vs `focos_risco`

**Antes da migration `20260711000000`:** `levantamento_itens` tinha `status_atendimento`, `acao_aplicada`, `data_resolucao`, `checkin_em`, `observacao_atendimento`.

**Depois:** esses campos foram removidos. O frontend os reconstrói como campos virtuais via `enrichItensComFoco()`.

**Risco residual:** ainda existem `levantamento_item_status_historico` (histórico do sistema antigo) e `foco_risco_historico` (sistema novo). As duas tabelas cobrem períodos diferentes, mas qualquer consulta de histórico precisa saber qual usar dependendo da data.

### 2. Recorrência em duas tabelas

- `levantamento_item_recorrencia` — sistema antigo, baseado em items
- `foco_risco.foco_anterior_id` — sistema novo, baseado em focos

Ambos representam "este foco aconteceu antes". Código legado usa a primeira; código novo usa a segunda.

### 3. `payload` JSONB como campo genérico

`levantamento_itens.payload` é usado exclusivamente para dados extras do pipeline Python (scores, metadados YOLO). Relações entre entidades **não** são armazenadas neste campo.

**Decisão arquitetural (ADR-QW03):** chaves de caso notificado (`caso_notificado_proximidade`, `casos_notificados_proximidade`) foram removidas do `payload` pela migration `20260710020000`. A relação caso↔foco é armazenada em:
- `caso_foco_cruzamento` — tabela relacional, fonte canônica de vínculos (many-to-many)
- `focos_risco.casos_ids` — UUID[], aggregate root para acesso rápido

O frontend consulta exclusivamente `caso_foco_cruzamento` via RPC — nunca o `payload`.

---

## Tabelas potencialmente legadas

| Tabela | Status | Motivo |
|--------|--------|--------|
| `levantamento_item_status_historico` | **Legada** | Substituída por `foco_risco_historico` |
| `levantamento_item_recorrencia` | **Parcialmente legada** | Convive com `foco_risco.foco_anterior_id` |
| `operacoes` | **Possivelmente legada** | Pré-focos_risco. Verificar se ainda é usada ativamente |
| `tags` / `levantamento_item_tags` | **Pouco utilizada** | Sem evidência de uso ativo no frontend |

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
