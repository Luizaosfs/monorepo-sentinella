# 03 — Backend

> **Para quem é este documento:** desenvolvedores que precisam entender onde a lógica de negócio vive, como o banco processa dados automaticamente, o que cada Edge Function faz e onde estão os principais pontos de acoplamento e duplicação.

---

## O que é o "backend" do Sentinella

O Sentinella não tem um servidor de aplicação tradicional (NestJS, Express, Django etc.). O backend é composto por três camadas distintas:

```
1. src/services/api.ts       — camada de serviço no frontend (TypeScript)
2. supabase/migrations/*.sql — banco de dados com lógica embutida (PL/pgSQL)
3. supabase/functions/*.ts   — Edge Functions serverless (Deno)
```

Cada camada tem uma responsabilidade diferente, e entender onde cada tipo de lógica deve viver é fundamental para manter o sistema coerente.

---

## 1. src/services/api.ts — A camada de serviço

**2.831 linhas. 45+ namespaces. Arquivo único.**

É o único arquivo autorizado a chamar `supabase.from(...)`, `supabase.rpc(...)` e `supabase.storage.from(...)`. Todo o frontend passa por ele.

### Estrutura interna

O arquivo exporta um único objeto `api` com namespaces organizados por domínio. Cada namespace é um objeto com funções assíncronas:

```typescript
export const api = {
  levantamentos: { list, updatePlanejamento },
  itens: { listByLevantamento, listByCliente, updateAtendimento, registrarCheckin, ... },
  sla: { listByCliente, listForPanel, updateStatus, escalar, reabrir, ... },
  focosRisco: { list, transicionar, ... },  // namespace mais novo (linha 2652)
  casosNotificados: { list, create, updateStatus, countProximoAoItem, ... },
  vistorias: { listByAgente, create, addDeposito, addSintomas, addRiscos, ... },
  imoveis: { list, create, update, listProblematicos, ... },
  // ... 40+ namespaces adicionais
}
```

### Namespaces completos (em ordem de aparição no arquivo)

| Linha | Namespace | Domínio |
|-------|-----------|---------|
| 82 | `levantamentos` | Levantamentos de campo |
| 103 | `itens` | Itens de levantamento |
| 339 | `evidenciasItem` | Evidências fotográficas |
| 369 | `clientes` | Prefeituras cadastradas |
| 401 | `planejamentos` | Planejamentos de operação |
| 439 | `tags` | Tags de itens |
| 452 | `cloudinary` | Upload/delete de imagens |
| 499 | `regioes` | Regiões geográficas |
| 512 | `sla` | SLA operacional |
| 616 | `operacoes` | Operações de atendimento |
| 864 | `map` | Dados para visualização em mapa |
| 932 | `pluvio` | Risco pluviométrico |
| 994 | `planoAcaoCatalogo` | Catálogo de planos de ação |
| 1053 | `recorrencias` | Recorrências de focos |
| 1088 | `yoloClassConfig` | Configuração de classes YOLO |
| 1102 | `slaFeriados` | Feriados para cálculo de SLA |
| 1135 | `slaIminentes` | SLAs prestes a vencer |
| 1157 | `slaConfigRegiao` | Config de SLA por região |
| 1185 | `quotas` | Controle de quota por cliente |
| 1242 | `pushSubscriptions` | Subscrições Web Push |
| 1272 | `condicoesVoo` | Condições meteorológicas de voo |
| 1288 | `yoloFeedback` | Feedback de falso positivo |
| 1316 | `analiseIa` | Análise IA pós-voo |
| 1340 | `casosNotificados` | Casos de dengue notificados |
| 1414 | `unidadesSaude` | UBS, UPAs e hospitais |
| 1445 | `imoveis` | Imóveis cadastrados |
| 1517 | `vistorias` | Vistorias domiciliares |
| 1662 | `admin` | Painel comparativo entre municípios |
| 1708 | `drones` | Cadastro de drones |
| 1744 | `voos` | Registros de voos |
| 1777 | `integracoes` | Configurações e-SUS Notifica |
| 1819 | `notificacoesESUS` | Notificações ao e-SUS |
| 1997 | `cnesSync` | Sincronização CNES/DATASUS |
| 2140 | `usuarios` | Gestão de usuários |
| 2200 | `riskPolicy` | Políticas de risco pluvial |
| 2223 | `droneRiskConfig` | Config de risco do drone |
| 2281 | `riskPolicyEditor` | Editor de políticas de risco |
| 2474 | `liraa` | Levantamento LIRAa |
| 2494 | `quarteiroes` | Gestão de quarteirões |
| 2508 | `distribuicaoQuarteirao` | Distribuição de agentes por quarteirão |
| 2573 | `scoreSurto` | Score de surto por bairro |
| 2584 | `notificacaoFormal` | Notificações formais a imóveis |
| 2595 | `yoloQualidade` | Qualidade de detecções YOLO |
| 2631 | `resumosDiarios` | Resumos diários de operação |
| 2652 | `focosRisco` | **Focos de risco — aggregate root** |

### Função `enrichItensComFoco()` — ponte entre mundos antigo e novo

**Localização:** `api.ts`, linha 64.

Esta função é um ponto crítico de manutenção. Ela reconstrói campos que existiam em `levantamento_itens` e foram removidos do banco na migration `20260711000000`:

```typescript
function enrichItensComFoco(rows) {
  // Para cada item, busca o foco_risco associado e reconstrói:
  // - status_atendimento  (de focos_risco.status)
  // - acao_aplicada       (de focos_risco.desfecho)
  // - data_resolucao      (de focos_risco.resolvido_em)
  // - observacao_atendimento → @virtual, no-op após migration 20260711
  // - foco_risco_id       (id do foco associado)
}
```

**Por que isso importa:** qualquer código que leia `item.status_atendimento` está na verdade lendo `focos_risco.status` transformado por esta função. Se a transformação estiver errada, o sistema exibe estados incorretos.

### Lógica de negócio presente no api.ts

**O que foi observado:** o arquivo contém algumas transformações além de queries puras.

Linha 59–60 — mapeamento de status legado para novo:
```typescript
if (s === 'resolvido' || s === 'descartado' || s === 'cancelado') return 'resolvido';
if (s === 'em_triagem' || s === 'em_tratamento' || s === 'confirmado') return 'em_atendimento';
```

Linha 2 — import de lógica de negócio externa:
```typescript
import { calcularSemanaEpidemiologica, montarPayloadESUS } from '@/lib/sinan';
```

**O que isso significa:** a camada de serviço não é puramente de acesso a dados — ela também converte, mapeia e monta payloads. Isso não é necessariamente errado, mas é importante saber ao ler o código.

### Chamadas RPC do api.ts

```
supabase.rpc('get_meu_papel')
supabase.rpc('resumo_agente_ciclo', { p_cliente_id, p_agente_id, p_ciclo })
supabase.rpc('listar_casos_no_raio', { p_lat, p_lng, p_raio, p_cliente })
supabase.rpc('contar_casos_proximos_ao_item', { p_item_id, p_raio })
supabase.rpc('canal_cidadao_denunciar', { ... })
supabase.rpc('fn_transicionar_foco', { p_foco_id, p_novo_status, p_responsavel_id, ... })
supabase.rpc('sincronizar_cnes_cliente', { p_cliente_id })
supabase.rpc('esus_notificar_item', { p_item_id, ... })
```

---

## 2. Banco de dados — Lógica embutida em PL/pgSQL

Esta é a camada mais crítica do sistema. Toda lógica que precisa ser garantida independentemente de quem escreve os dados (frontend, pipeline Python, Edge Functions) vive aqui.

### Funções auxiliares usadas pelas políticas RLS

Definidas em migrations iniciais, reutilizadas em todo o sistema:

| Função | O que faz | Migrations que a usam |
|--------|-----------|-----------------------|
| `public.is_admin()` | Retorna true se o usuário autenticado tem papel admin | RLS de múltiplas tabelas |
| `public.is_operador()` | Retorna true se o papel é operador | RLS de operações e evidências |
| `public.usuario_cliente_id()` | Retorna o cliente_id do usuário autenticado | Políticas de isolamento |
| `public.usuario_pode_acessar_cliente(uuid)` | Verifica se o usuário tem acesso ao cliente especificado | Tabelas com acesso cross-cliente por admin |
| `public.usuario_pode_acessar_risk_policy(uuid)` | Verifica acesso a uma política de risco específica | `risk_policies` |

### Funções de cálculo de SLA

**Evidência de duplicação:** A lógica de cálculo de SLA existe em dois lugares:

**No banco** (`20250303000000_sla_operacional_gerar_e_rls.sql`):
```sql
CREATE OR REPLACE FUNCTION public.sla_horas_from_config(prioridade, regiao_id, cliente_id)
CREATE OR REPLACE FUNCTION public.sla_aplicar_fatores(horas_base, classificacao_risco, persistencia_7d, temp_media_c)
```

A função `sla_aplicar_fatores` é chamada em **8 migrations diferentes**, incluindo:
- `20250303000000` — SLA base
- `20250309100000` — SLA para itens pluvio
- `20250309110000` — Escalamento
- `20250309130000` — SLA para levantamento_item
- `20250311130000` — Feriados e horário comercial
- `20250311180000` — Config por região

**No TypeScript** (`src/types/sla.ts`):
```typescript
export function calcularSlaHoras(prioridade, classificacaoRisco, persistencia7d, tempMediaC)
```

**Risco real:** se os fatores de redução mudarem em um lado, o outro lado diverge silenciosamente. O frontend usa a função TypeScript para exibição e estimativas; o banco usa a PL/pgSQL para persistência real. Uma prefeitura que veja prazos diferentes no painel vs. no alerta está sendo afetada por essa divergência.

### Triggers mapeados por domínio

#### Triggers de SLA
| Trigger | Tabela | O que faz |
|---------|--------|-----------|
| `trg_sla_on_item_insert` | `levantamento_itens` | Cria `sla_operacional` automaticamente ao confirmar item |
| `trg_operacao_concluida_sla` | `operacoes` | Fecha SLA ao concluir operação |
| `trg_sla_vencidos` | (cron via Edge Function) | Marca SLAs vencidos periodicamente |

#### Triggers de focos_risco
| Trigger | O que faz |
|---------|-----------|
| `trg_focos_risco_historico` | A cada UPDATE em `focos_risco`, grava entrada em `foco_risco_historico` |
| `trg_focos_risco_state_machine` | Valida transições de estado (apenas transições permitidas passam) |
| `trg_focos_risco_imutavel_levantamento_item` | Bloqueia UPDATE em `levantamento_itens` para campos que foram migrados para `focos_risco` |

#### Triggers de vistoria
| Trigger | O que faz |
|---------|-----------|
| `trg_sintomas_para_caso` | Ao inserir `vistoria_sintomas` com moradores afetados, cria `caso_notificado` automaticamente |
| `trg_atualizar_perfil_imovel` | Após 3 tentativas sem acesso, eleva `prioridade_drone=true` no imóvel |

#### Triggers de cruzamento
| Trigger | O que faz |
|---------|-----------|
| `trg_cruzar_caso_focos` | Ao inserir `caso_notificado`, busca focos em raio de 300m (PostGIS ST_DWithin), eleva prioridade para Crítico, registra em `caso_foco_cruzamento` |

#### Triggers de auditoria e updated_at
Praticamente toda tabela tem `trg_<tabela>_updated_at` que mantém `updated_at` atualizado via função `update_updated_at_column()`.

#### Trigger de quota
| Trigger | O que faz |
|---------|-----------|
| `trg_quota_enforcement` | Verifica limite de imagens/itens antes de inserir. Adicionado em `20260319241000` |

---

## 3. Edge Functions (Deno)

12 funções serverless rodando no runtime Deno do Supabase. Todas usam `service_role` key para acesso ao banco, o que significa que **bypassam o RLS**.

### Mapeamento completo

| Função | Gatilho | Descrição |
|--------|---------|-----------|
| `pluvio-risco-daily` | Cron diário | Busca dados de chuva por bairro, calcula score de risco, persiste em `pluvio_risco_runs` |
| `sla-marcar-vencidos` | Cron frequente | Varre `sla_operacional`, marca como `vencido` os que ultrapassaram `prazo_fim`, dispara escalamento |
| `sla-push-critico` | Cron a cada hora (ou 30min) | Busca SLAs com ≤1h restante, envia Web Push via VAPID para subscrições ativas |
| `relatorio-semanal` | Cron seg 8h UTC | Gera relatório HTML com KPIs da semana, envia via Resend API para email do supervisor |
| `resumo-diario` | Cron diário | Gera resumo das atividades do dia, persiste em `resumos_diarios` |
| `triagem-ia-pos-voo` | HTTP POST (manual pelo gestor) | Agrupa itens por grade 0.001°, filtra falsos positivos, chama Claude Haiku, persiste sumário em `levantamento_analise_ia` |
| `cnes-sync` | Cron 3h UTC **ou** HTTP POST manual | Dois modos: agendado (percorre todos os clientes com UF+IBGE configurados) ou manual (um cliente específico). Retry 3x com backoff exponencial. |
| `upload-evidencia` | HTTP POST | Recebe arquivo, faz upload no Cloudinary com metadados, retorna URL |
| `cloudinary-upload-image` | HTTP POST | Upload direto de imagem para Cloudinary |
| `cloudinary-delete-image` | HTTP DELETE | Remove imagem do Cloudinary por public_id |
| `geocode-regioes` | HTTP POST | Geocodifica endereços de regiões cadastradas sem coordenadas |
| `identify-larva` | HTTP POST | Analisa foto via IA para identificar presença de larvas |

### Dependências externas das Edge Functions

| Função | Depende de |
|--------|-----------|
| `sla-push-critico` | VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (secrets) |
| `relatorio-semanal` | RESEND_API_KEY (secret) |
| `cnes-sync` | API CNES/DATASUS (URL pública federal) |
| `triagem-ia-pos-voo` | ANTHROPIC_API_KEY (Claude Haiku) |
| `upload-evidencia`, `cloudinary-*` | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET |
| `identify-larva` | Modelo de IA (Anthropic ou similar) |

### Risco: todas as Edge Functions usam service_role

**Observado:** o header de `sla-push-critico` mostra:
```typescript
const sb = createClient(supabaseUrl, serviceRoleKey)
```

Isso é necessário para que as funções operem em dados de todos os clientes. Porém, **uma Edge Function com bug pode ler ou escrever dados de qualquer prefeitura sem restrição**. Não há auditoria de quais funções acessam quais clientes nas Edge Functions.

---

## 4. Pipeline Python (sistema externo)

**Não está neste repositório.** O pipeline roda em separado e se conecta ao banco Supabase via API. Os dados que ele injeta chegam como se fossem inserções normais de cliente autenticado.

**Risco identificado:** não está documentado se o pipeline usa `anon key` (sujeito a RLS) ou `service_role key` (bypassa RLS). Se usar `service_role`, tem acesso irrestrito a dados de todos os clientes. Esta auditoria está pendente.

---

## 5. Pontos de acoplamento e gargalos de manutenção

### Gargalo 1: api.ts monolítico (2.831 linhas)

O arquivo cresceu organicamente ao longo de 87+ migrations sem divisão por domínio. Consequências práticas:
- Conflitos de merge frequentes quando dois desenvolvedores trabalham em áreas diferentes
- Onboarding lento: difícil saber onde adicionar código novo
- Risco de duplicações não percebidas (dois métodos similares em namespaces distantes)
- Dificuldade de testar isoladamente

**O que não é ainda problema:** a arquitetura está correta — um único ponto de acesso ao banco. O problema é apenas a falta de divisão em módulos.

### Gargalo 2: Duplicação de regras de SLA

`calcularSlaHoras()` em TypeScript e `sla_aplicar_fatores()` em PL/pgSQL calculam a mesma coisa. A única fonte de verdade real é o banco — o TypeScript serve apenas para exibição antecipada. Mas se um gestor vir um prazo no frontend diferente do que o banco calculou, será difícil diagnosticar.

### Gargalo 3: enrichItensComFoco() é um ponto de falha silencioso

Se uma query em `api.itens.*` esquecer de chamar `enrichItensComFoco()`, o item retornado terá campos virtuais como `null` sem nenhum erro. Isso seria exibido ao usuário como "sem status" quando na verdade há um foco de risco ativo.

### Gargalo 4: AdminSla.tsx acessa supabase diretamente

**Observado** em `src/pages/admin/AdminSla.tsx` (linha 5):
```typescript
import { supabase } from '@/lib/supabase';
```

Esta é uma **violação do padrão estabelecido**. O arquivo acessa o banco diretamente, fora do `api.ts`. Isso significa que a query nessa página não passa pela camada de serviço e não tem as garantias de filtro por `cliente_id` auditadas centralmente.

---

## 6. Regras de negócio — onde cada uma vive

| Tipo de regra | Onde vive | Evidência |
|---------------|-----------|-----------|
| Cálculo de SLA | Banco (`sla_aplicar_fatores`) + Frontend (`calcularSlaHoras`) | Duplicado |
| Transição de estado de foco | Banco (`fn_transicionar_foco` + trigger) | Correto |
| Cruzamento caso↔foco | Banco (`trg_cruzar_caso_focos`) | Correto |
| Criação automática de caso notificado | Banco (`trg_sintomas_para_caso`) | Correto |
| Prioridade de drone (3 tentativas) | Banco (`trg_atualizar_perfil_imovel`) | Correto |
| Normalização de score YOLO | Frontend (`scoreUtils.ts`) | Correto |
| Filtro por cliente_id | Frontend (api.ts) + Banco (RLS) | Dupla proteção — correto |
| Ciclo epidemiológico (bimestre) | Frontend (calculado) + Banco (campo `ciclo` persistido) | Correto |
| Validação de acesso por papel | Frontend (guards de rota) + Banco (is_admin, is_operador) | Dupla proteção — correto |
| Quota de imagens | Banco (trigger `trg_quota_enforcement`) | Correto |

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
