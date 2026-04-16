# Regras de Negócio Oficiais — SentinelaWeb

> Documento de referência consolidado. Gerado em 2026-04-01.
> Em caso de conflito com código, prevalece este documento — abrir issue para corrigir o código.

---

## 1. Multitenancy e Isolamento de Dados

### 1.1 Cliente = Prefeitura
- Cada **cliente** representa uma prefeitura.
- Todo dado do sistema pertence a exatamente um `cliente_id`.
- **Toda** query ao banco deve filtrar por `cliente_id`. Sem exceção.

### 1.2 RLS (Row Level Security)
- Toda tabela tem RLS habilitado.
- A função canônica de isolamento é `usuario_pode_acessar_cliente(cliente_id uuid)`.
- **Padrão obrigatório de política:**
  ```sql
  CREATE POLICY "tabela_select" ON public.tabela
    FOR SELECT TO authenticated
    USING (public.usuario_pode_acessar_cliente(cliente_id));
  ```
- **Proibido:** `USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()))` — padrão antigo, lento e substituído.
- **Proibido:** `USING (true)` — expõe dados de todos os clientes.

### 1.3 Hook de multitenancy no frontend
```typescript
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const { clienteId } = useClienteAtivo();
```
Nunca hardcodar `cliente_id`. Nunca buscar sem filtrar por `clienteId`.

---

## 2. Focos de Risco — Aggregate Root

### 2.1 State machine (8 estados)
```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
                                                                                      ↘ descartado
```
- `resolvido` e `descartado` são **terminais** — não se reabre um foco; cria-se novo com `foco_anterior_id`.
- SLA começa a contar em `confirmado_em`, não em `suspeita_em`.

### Transições permitidas
| Estado | Pode ir para |
|--------|-------------|
| `suspeita` | `em_triagem`, `descartado` |
| `em_triagem` | `aguarda_inspecao`, `descartado` |
| `aguarda_inspecao` | `em_inspecao`, `confirmado`, `descartado` |
| `em_inspecao` | `confirmado`, `descartado` |
| `confirmado` | `em_tratamento`, `descartado` |
| `em_tratamento` | `resolvido`, `descartado` |
| `resolvido` | *(terminal)* |
| `descartado` | *(terminal)* |

### 2.2 Transições
- **Única forma de mudar status:** RPC `rpc_transicionar_foco_risco`.
- **Proibido:** `UPDATE focos_risco SET status = ...` direto.
- `foco_risco_historico` é append-only — nunca UPDATE/DELETE.

### 2.5 Classificação inicial
- `classificacao_inicial` enum: `suspeito`, `risco`, `foco`, `caso_notificado`
- Definida na criação do foco, independente do status operacional.
- Alterável via RPC `rpc_atualizar_classificacao_inicial`.

### 2.6 Dados mínimos
- `dados_minimos_em` preenchido automaticamente quando foco tem todos os campos obrigatórios.
- View `v_focos_dados_minimos_status` retorna checklist de completude.
- Campos obrigatórios: `imovel_id`, `latitude`, `longitude`, `classificacao_inicial`, `responsavel_id`.

### 2.3 Colunas removidas de `levantamento_itens` (migration 20260711)
As colunas abaixo **não existem mais**. Nunca referenciar:
- `status_atendimento`
- `acao_aplicada`
- `data_resolucao`
- `checkin_em`, `checkin_latitude`, `checkin_longitude`
- `observacao_atendimento`

Esses campos são reconstituídos virtualmente pela função `enrichItensComFoco()` em `src/lib/enrichItensComFoco.ts`.

### 2.4 Triggers removidos de `levantamento_itens`
- `trg_levantamento_item_status_historico` — dropado em A01/A06 (20260911)
- `trg_validar_transicao_status_atendimento` — dropado em FIX-03 (20260913)
- `trg_congelar_status_atendimento` — dropado em A01 (20260911)

Funções órfãs removidas em CLEANUP-02 (20260914).

---

## 3. Canal Cidadão

### 3.1 RPC `denunciar_cidadao`
Assinatura: `denunciar_cidadao(slug, bairro_id, descricao, latitude?, longitude?, foto_url?, foto_public_id?)`

Retorna: `{ ok, foco_id, deduplicado }`
- O **protocolo** exibido ao cidadão são os **8 primeiros caracteres** do `foco_id` (UUID).
- O campo retornado é `foco_id` — **não** `item_id` (campo legado removido).

### 3.2 Rate limit
- Máximo **5 envios por IP por janela de 30 minutos** (tabela `canal_cidadao_rate_limit`).
- Limite armazenado por hash MD5 de `(ip + cliente_id)` para privacidade do IP.

### 3.3 Deduplicação geoespacial
- Se já existe um `foco_risco` com `origem_tipo = 'cidadao'` no mesmo cliente, a ≤ 30m e nas últimas 24h, **não cria novo foco** — incrementa `payload.confirmacoes` do foco existente.
- Deduplicação usa PostGIS `ST_DWithin` em `focos_risco.latitude/longitude`.

### 3.4 Consulta de protocolo
- RPC pública: `consultar_denuncia_cidadao(protocolo text)`
- Busca `focos_risco` por `starts_with(id::text, protocolo)` e `origem_tipo = 'cidadao'`.
- Disponível sem autenticação em `/denuncia/consultar`.

### 3.5 LGPD
- Denúncias de cidadão **não armazenam** dados pessoais identificáveis.
- `focos_risco` armazena apenas: coordenadas, descrição livre, bairro_id e URL de foto (opcional).

---

## 4. Levantamentos e Itens

### 4.1 `levantamento_itens.cliente_id`
- Campo **denormalizado** de `levantamentos.cliente_id`.
- Preenchido automaticamente pelo trigger `trg_levantamento_itens_set_cliente_id` no INSERT.
- **Nunca setar manualmente.**

### 4.2 `levantamentos.total_itens`
- Mantido pelo trigger `trg_sync_total_itens` (migration A10) em INSERT/UPDATE/DELETE/soft-delete.
- **Não calcular no frontend.**

### 4.3 Soft Delete
- Tabelas críticas possuem `deleted_at timestamptz`.
- Hard DELETE é bloqueado pelo trigger `trg_bloquear_hard_delete`.
- Filtrar sempre com `.is('deleted_at', null)` em queries ativas.

---

## 5. Vistoria de Campo

### 5.1 Tipos de depósito PNCD
| Código | Descrição |
|--------|-----------|
| A1 | Caixa d'água elevada |
| A2 | Outro armazenamento |
| B  | Pequenos depósitos móveis |
| C  | Depósitos fixos |
| D1 | Pneus e materiais rodantes |
| D2 | Lixo |
| E  | Depósitos naturais |

### 5.2 Ciclos anuais
- 6 ciclos por ano (bimestral): `ciclo = CEIL(mes / 2)`.
- Ciclo 1 = Jan–Fev, ..., Ciclo 6 = Nov–Dez.

### 5.3 Acesso a imóvel
- **3 tentativas sem acesso** (qualquer motivo) → trigger eleva `imoveis.prioridade_drone = true` automaticamente.
- `v_imovel_historico_acesso` é somente-leitura — nunca inserir manualmente.
- `requer_notificacao_formal` = `pct_sem_acesso > 80%` **ou** `proprietario_ausente = true`.

### 5.4 Calhas
- Calhas inacessíveis devem atualizar `imoveis.calha_acessivel = false` ao finalizar vistoria.
- Registros em `vistoria_calhas` com posição/condição/foco.

### 5.5 Trigger sintomas → caso notificado
- Após INSERT em `vistoria_sintomas` com `moradores_sintomas_qtd > 0`:
  - Cria automaticamente registro em `casos_notificados` com `doenca = 'suspeito'`.
  - LGPD: **não armazena** nome, CPF ou identificação do morador.

### 5.6 Reinspeção Pós-Tratamento
- Ao foco entrar em `em_tratamento`, trigger `trg_criar_reinspecao_pos_tratamento` cria reinspeção automática pendente (7 dias default).
- Ao resolver/descartar foco, trigger `trg_cancelar_reinspecoes_ao_fechar_foco` cancela todas reinspeções pendentes.
- Máximo 1 reinspeção pendente por `(foco_risco_id, tipo)` — idempotência via unique partial index `WHERE status='pendente'`.
- **Resultados possíveis:**
  - `resolvido` — foco pode ser encerrado (`pode_resolver_foco = true`)
  - `persiste` — foco permanece em tratamento; supervisor deve criar novo tratamento
  - `nao_realizado` — impedimento; reinspeção pode ser reagendada
- Rota agente: `/agente/reinspecao/:reinspecaoId`
- RPCs: `rpc_registrar_reinspecao_resultado`, `rpc_criar_reinspecao_manual`, `rpc_cancelar_reinspecao`, `rpc_reagendar_reinspecao`
- `fn_marcar_reinspecoes_vencidas()` executa diariamente via cron 06h UTC.

---

## 6. Casos Notificados

### 6.1 LGPD — dados proibidos
`casos_notificados` **NÃO armazena:**
- Nome do paciente
- CPF
- Data de nascimento
- Qualquer identificador direto

Armazena apenas: endereço, bairro de residência, coordenadas, tipo de doença e status.

### 6.2 Cruzamento caso ↔ foco
- Feito exclusivamente pelo trigger `trg_cruzar_caso_focos` no banco (PostGIS 300m).
- `caso_foco_cruzamento` é preenchido **somente pelo trigger** — nunca inserir manualmente.
- Foco próximo (≤ 300m) tem prioridade elevada para `Crítico` automaticamente.

---

## 7. SLA

O SLA é criado automaticamente quando um foco transiciona para `confirmado` (trigger `fn_iniciar_sla_ao_confirmar_foco`).

### 7.1 Prioridades e prazos padrão (configuráveis por cliente via `sla_config`)

| Prioridade | SLA padrão | Mnemônico |
|-----------|-----------|-----------|
| P1 | 4h | Crítico — foco confirmado próximo a caso notificado |
| P2 | 12h | Alto — foco confirmado com score YOLO alto |
| P3 | 24h | Médio — padrão geral |
| P4 | 72h | Baixo — monitoramento |
| P5 | 168h (7d) | Mínimo — apenas rastreamento |
| **Mínimo absoluto** | **2h** | sempre |

O SLA pode ser personalizado por cliente e por região via `sla_config` e `sla_config_regiao`.

### 7.2 Funções de SLA no banco
- `fn_iniciar_sla_ao_confirmar_foco` — cria SLA ao confirmar foco.
- `fn_fechar_sla_ao_resolver_foco` — fecha SLA quando foco resolve/descarta.
- `fn_vincular_sla_ao_confirmar` — vincula SLA existente do item ao foco.

### 7.3 SLA no frontend
- `SLA_RULES` em `src/types/sla.ts` é constante `@deprecated` mantida apenas para referência visual.
- A fonte de verdade é `sla_config` no banco.
- `calcularSlaHoras()` no frontend é usada apenas para estimativa visual — o banco calcula o SLA real.
- **Não duplicar** lógica de SLA em outros arquivos.

---

## 8. Score YOLO

### 8.1 Normalização
O pipeline Python pode gravar `score_final` em duas escalas:
- `0–1` (ex: `0.87`) → já normalizado
- `0–100` (ex: `87`) → dividir por 100

```typescript
function normalizeScore(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}
```

### 8.2 Faixas de confiança
| Score | Classificação | Cor |
|-------|--------------|-----|
| ≥ 0.85 | Muito alta | Vermelho — alta certeza de foco real |
| ≥ 0.65 | Alta | Laranja |
| ≥ 0.45 | Média | Âmbar |
| < 0.45 | Baixa | Verde — priorizar vistoria manual |

Itens com `tipo_entrada = 'MANUAL'` não têm score — exibir "Entrada manual".

---

## 9. Papéis de Usuário (RBAC)

| Papel | Acesso |
|-------|--------|
| `admin` | Nível máximo — todas as funcionalidades do cliente |
| `gestor` | Dashboard, mapas, focos, casos |
| `operador` | Vistoria de campo, levantamentos |
| `notificador` | Registro de casos (UBS/hospital) |
| `agente` | Visão diária, formulário de vistoria simplificado |

> **`platform_admin`** é valor morto no enum `papel_app`. Nenhum usuário deve ter este papel. Nunca criar usuários com `platform_admin`. Usar `admin` como nível máximo.

---

## 10. Integração CNES/DATASUS

### 10.1 Pré-requisitos
- `clientes.uf` e `clientes.ibge_municipio` devem estar preenchidos (7 dígitos).
- Sem estes campos, a Edge Function `cnes-sync` rejeita com 422.

### 10.2 Inativação suave
- Unidades ausentes na resposta CNES são **inativadas** (`ativo = false`), nunca deletadas.
- Unidades com `origem = 'manual'` e `cnes IS NULL` **nunca são inativadas** pela sync.
- Preserva histórico de casos notificados vinculados.

---

## 11. Integração e-SUS Notifica

### 11.1 Configuração por cliente
- Cada cliente configura sua própria API key, código IBGE, CNES, e ambiente (homologação/produção).
- Configurações em `cliente_integracoes` com RLS.

### 11.2 Envio
- Notificações enviadas por `api.notificacoesESUS.enviar()`.
- Histórico rastreado em `item_notificacoes_esus`.

---

## 12. Risco Pluvial

### 12.1 Janela crítica
- **3–6 dias após chuva intensa** = larvas em desenvolvimento ativo = janela mais crítica para operação.

### 12.2 Variáveis do modelo
- `chuva_mm` — volume 24h
- `dias_sem_chuva` — janela seca pós-chuva
- `temperatura` — fator multiplicador (ótimo 25–30°C)
- `vento` — fator redutor (acima de 13 km/h)
- `persistencia_7d` — dias consecutivos com chuva relevante
- `tendencia` — crescente (+5pp), estável (0), decrescente (-5pp)

---

## 13. Cloudinary e Arquivos

### 13.1 Colunas `*_public_id`
Todas as tabelas com imagens possuem campo `*_public_id` para rastreio no Cloudinary.
Tabelas: `levantamento_itens`, `vistorias`, `vistoria_calhas`, `levantamento_item_evidencias`, `operacao_evidencias`.

### 13.2 Purga
- Arquivos órfãos registrados em `cloudinary_orfaos` com `retention_until` (padrão 5 anos).
- Edge Function `cloudinary-cleanup-orfaos` processa a fila.

---

## 14. Offline e Fila IndexedDB

### 14.1 Operações suportadas offline
- `checkin`
- `update_atendimento`
- `save_vistoria` (create → depositos → sintomas → riscos)

### 14.2 Garantias
- Idempotência via `operationId` único.
- Mutex por operação — sem envios duplicados.
- Backoff exponencial em falhas de rede.
- Fila drenada automaticamente ao reconectar (hook `useOfflineQueue`).

---

## 15. Migrations — Histórico Crítico

| Migration | O que faz |
|-----------|-----------|
| 20260711000000 | **REMOVE** colunas de `levantamento_itens` (status_atendimento etc.) |
| 20260718000000 | Soft delete em 4 tabelas + trigger hard delete |
| 20260720000000 | Colunas `*_public_id` + tabela `cloudinary_orfaos` |
| 20260911000000 | A01: denorma `cliente_id` em `levantamento_itens` |
| 20260911030000 | A10: trigger `total_itens` bidirecional |
| 20260912040000 | M08: padroniza RLS para `usuario_pode_acessar_cliente()` |
| 20260913000002 | FIX-03: remove funções órfãs de `status_atendimento` |
| 20260914000000 | CLEANUP-01: consolida `denunciar_cidadao` em 1 overload |
| 20260914000002 | CLEANUP-03: remove políticas RLS duplicadas |
| 20260915000000 | FIX FINAL: `denunciar_cidadao` com rate limit + dedup PostGIS |

### Migrations obsoletas (manter, não reexecutar)
As seguintes migrations contêm código que pode conflitar se reexecutado:
- `20260326173000` — compat shim `consultar_denuncia_cidadao` (substituído em 20260915)
- `20260720000000` — versão quebrada de `denunciar_cidadao` (referenciava `levantamento_itens`)
- `20260800020000` — fix parcial (ainda referenciava `levantamento_itens`)

---

---

## 16. Reinspeção Programada

Ver seção 5.6 para regras operacionais.

### 16.1 Tipos
- `eficacia_pos_tratamento` — verificação automática 7 dias pós-tratamento
- `retorno_operacional` — criada manualmente pelo supervisor

### 16.2 Status do ciclo de vida
`pendente` → `realizada` | `cancelada` | `vencida`

### 16.3 Invariantes
- Só 1 reinspeção `pendente` por `(foco_risco_id, tipo)` — garantido por unique partial index.
- `fn_marcar_reinspecoes_vencidas()` promove `pendente` → `vencida` quando `data_prevista < NOW()`.
- Ao criar novo foco com `foco_anterior_id`, não herda reinspeções do foco anterior.

---

*Última atualização: 2026-04-12*
