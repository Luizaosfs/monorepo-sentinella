# 02 — Arquitetura Geral

> **Para quem é este documento:** desenvolvedores e arquitetos que precisam entender as decisões técnicas do sistema antes de contribuir ou avaliar mudanças.

---

## Visão de camadas

```
┌─────────────────────────────────────────────────────────┐
│  NAVEGADOR  (React 18 + TypeScript + Vite)              │
│                                                          │
│  Páginas → Componentes → Hooks (React Query)            │
│                │                                         │
│                ▼                                         │
│        src/services/api.ts                              │
│        (único ponto de contato com o banco)             │
└──────────────────────┬──────────────────────────────────┘
                       │ Supabase JS Client
                       ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE                                               │
│                                                          │
│  Auth (JWT)  │  Storage  │  Edge Functions (Deno)       │
│              │            │                              │
│              ▼            ▼                              │
│         PostgreSQL + RLS + Triggers + RPCs              │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  EXTERNOS                                               │
│                                                          │
│  Pipeline Python  │  Cloudinary  │  Resend  │  CNES API │
│  (drone/YOLO)     │  (imagens)   │  (email) │  (DATASUS)│
└─────────────────────────────────────────────────────────┘
```

---

## Stack principal

| Camada | Tecnologia | Versão / Notas |
|--------|-----------|----------------|
| Framework frontend | React | 18 |
| Linguagem | TypeScript | strict mode |
| Build | Vite | com alias `@/` para `src/` |
| Estilo | Tailwind CSS | com shadcn/ui (Radix UI) |
| Estado servidor | TanStack React Query | v5 |
| Roteamento | React Router | v6 |
| Backend | Supabase | PostgreSQL + Auth + Edge Functions |
| Edge Functions | Deno | runtime Supabase |
| PWA | Workbox | Service Worker, cache offline |
| Armazenamento offline | IndexedDB | via `offlineQueue.ts` |
| Imagens | Cloudinary | upload via Edge Function |
| Email | Resend | relatório semanal + alertas CNES |

---

## A regra de ouro da arquitetura frontend

> **Nenhum componente acessa o Supabase diretamente. Todo acesso passa por `src/services/api.ts`.**

Isso não é apenas convenção — há uma regra ESLint planejada para fazer `import from '@/lib/supabase'` falhar em componentes de página. O arquivo `api.ts` é a única camada que chama `supabase.from(...)`, `supabase.rpc(...)` e `supabase.storage.from(...)`.

**Por que isso importa:** permite centralizar o filtro de `cliente_id` (multitenancy), tratar erros de forma consistente, e substituir o Supabase por outro backend no futuro sem tocar em nenhum componente.

---

## Fluxo de dados típico

```
Componente React
   │
   ├── chama useAlgumHook(clienteId)        ← src/hooks/queries/
   │      │
   │      └── useQuery({ queryFn: () => api.modulo.metodo(clienteId) })
   │               │
   │               └── api.ts: supabase.from('tabela').select(...).eq('cliente_id', clienteId)
   │                              │
   │                              └── PostgreSQL: aplica RLS → retorna só dados do cliente
   │
   └── renderiza dados com loading/error states
```

### Cache e sincronização com React Query

Cada query tem um `staleTime` configurado via constantes centralizadas em `src/lib/queryConfig.ts`:

```
LIVE        = 0         (sempre refetch — SLA crítico, alertas)
VERY_SHORT  = 30s       (painel SLA com polling)
SHORT       = 1min      (casos, operações ativas)
RECENT      = 2min      (quotas, evidências)
MEDIUM      = 3min      (padrão geral)
MODERATE    = 5min      (pluvio, planejamentos)
MAP         = 10min     (dados cartográficos)
EXTENDED    = 15min     (condições de voo)
STATIC      = 30min     (configurações estáveis)
SESSION     = Infinity  (policies de risco — enquanto a sessão durar)
```

**Regra:** nunca usar número literal em `staleTime` — sempre usar a constante correspondente.

---

## Multitenancy — como funciona em três camadas

O isolamento entre prefeituras é implementado em três camadas independentes. Se uma falha, as outras ainda protegem:

### Camada 1: Frontend — `useClienteAtivo`
O hook `src/hooks/useClienteAtivo.tsx` é a única fonte de verdade para o `clienteId` ativo. Todo componente deve usá-lo — nunca derivar o `clienteId` de `localStorage` diretamente ou de `supabase.auth.getUser()`.

Comportamento:
- Admin vê todos os clientes ativos, persiste seleção em `localStorage`
- Qualquer outro papel vê apenas o próprio `cliente_id`

### Camada 2: Serviço — `api.ts`
Todo método do `api.ts` filtra explicitamente por `cliente_id`. Sem exceção. Exemplo:
```typescript
// OBRIGATÓRIO em todo select de lista
.eq('cliente_id', clienteId)

// Para tabelas sem cliente_id direto (join implícito):
.select('*, levantamento:levantamentos!inner(*)')
.eq('levantamento.cliente_id', clienteId)
```

### Camada 3: Banco — RLS (Row Level Security)
Políticas PostgreSQL garantem que cada usuário só acessa linhas do seu `cliente_id`, mesmo que as camadas 1 e 2 cometam um erro. O padrão de política:

```sql
CREATE POLICY "isolamento_por_cliente" ON nome_tabela
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));
```

---

## Controle de acesso (RBAC)

### Os cinco papéis

```
admin        → acesso total a todas as prefeituras
supervisor   → admin de uma prefeitura específica
usuario      → gestor/dashboard de uma prefeitura
operador     → portal de campo (/operador/*)
notificador  → registro de casos (/notificador/*)
```

Papéis legados mapeados na normalização: `platform_admin → admin`, `moderador → supervisor`.

O papel é obtido via RPC `get_meu_papel` no banco, com fallback para a tabela `papeis_usuarios`.

### Guards de rota

Os guards são **componentes React reais** que verificam o papel e redirecionam — não são apenas hints de UI:

- `AdminOrSupervisorGuard` — protege todas as rotas `/admin/*`
- `OperadorGuard` — protege `/operador/*` e `/agente/*`

Se um usuário tenta acessar uma rota protegida sem o papel correto, é redirecionado para `/`.

---

## O banco de dados como camada de lógica

Uma decisão arquitetural central do Sentinella: **lógica crítica de negócio vive no banco**, não no frontend. Isso garante que a lógica seja aplicada independentemente de qual cliente (frontend, pipeline Python, Edge Function) inserir dados.

### Triggers automáticos

| Trigger | O que faz |
|---------|-----------|
| `trg_criar_sla_para_item` | Cria `sla_operacional` automaticamente ao inserir `levantamento_item` confirmado |
| `trg_cruzar_caso_focos` | Ao inserir `caso_notificado`, busca focos em 300m via PostGIS e eleva prioridade para Crítico |
| `trg_sintomas_para_caso` | Ao inserir `vistoria_sintomas` com moradores afetados, cria `caso_notificado` automaticamente |
| `trg_atualizar_perfil_imovel` | Após 3 tentativas sem acesso, eleva `prioridade_drone=true` no imóvel |
| `trg_focos_risco_historico` | A cada mudança de estado em `focos_risco`, grava entrada imutável em `foco_risco_historico` |

### RPCs (Remote Procedure Calls)

Funções PL/pgSQL chamadas via `supabase.rpc(...)` para operações que exigem validações complexas ou acesso a múltiplas tabelas atomicamente:

- `get_meu_papel` — retorna o papel do usuário autenticado
- `resumo_agente_ciclo` — estatísticas do agente no ciclo atual
- `listar_casos_no_raio` — busca geoespacial de casos por raio
- `contar_casos_proximos_ao_item` — count para o banner de casos próximos
- `canal_cidadao_denunciar` — SECURITY DEFINER (permite inserção sem auth)
- `fn_transicionar_foco` — valida e executa transições de estado em `focos_risco`

### Views

- `v_focos_risco_ativos` — view paginável dos focos ativos com dados join de levantamento_item
- `v_imovel_historico_acesso` — histórico de tentativas por imóvel (somente leitura)

---

## Edge Functions (serverless Deno)

12 funções rodando no runtime Deno do Supabase:

| Função | Gatilho | O que faz |
|--------|---------|-----------|
| `pluvio-risco-daily` | Cron diário | Calcula risco pluviométrico por bairro |
| `sla-marcar-vencidos` | Cron frequente | Marca SLAs vencidos e aciona alertas |
| `sla-push-critico` | Cron/evento | Envia Web Push para SLAs com ≤1h restante |
| `relatorio-semanal` | Cron seg 8h | Gera e envia relatório HTML via Resend |
| `resumo-diario` | Cron diário | Resumo de atividade do dia |
| `triagem-ia-pos-voo` | HTTP (manual) | Cluster + Claude Haiku → sumário de levantamento |
| `cnes-sync` | Cron 3h UTC / manual | Sincroniza unidades de saúde com DATASUS |
| `upload-evidencia` | HTTP | Upload para Cloudinary com vínculo rastreável |
| `cloudinary-upload` | HTTP | Upload direto de imagem |
| `cloudinary-delete` | HTTP | Remoção de imagem |
| `geocode-regioes` | HTTP | Geocodificação de regiões cadastradas |
| `identify-larva` | HTTP | Identificação de larvas via IA em foto |

---

## Pipeline de drone (sistema externo)

O pipeline Python **não está neste repositório**. É um sistema separado que:

1. Executa o voo e captura imagens
2. Extrai coordenadas GPS das imagens via **ExifTool**
3. Processa imagens com **YOLO** para detectar focos suspeitos
4. Faz upload das imagens para **Cloudinary**
5. Insere os resultados no banco via RPC Supabase

O score YOLO pode vir em escala `0–1` ou `0–100` (dependendo da versão do pipeline). O frontend **sempre normaliza** antes de exibir:
```typescript
function normalizeScore(raw: number | null): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}
```

Faixas de confiança após normalização: ≥0.85 Muito alta / ≥0.65 Alta / ≥0.45 Média / <0.45 Baixa.

---

## PWA e modo offline

O Sentinella é um **Progressive Web App** instalável no celular. O suporte offline usa:

- **Workbox** (Service Worker) para cache de assets estáticos e algumas respostas de API
- **IndexedDB** via `src/lib/offlineQueue.ts` para enfileirar operações de escrita offline
- Ao reconectar, `src/hooks/useOfflineQueue.ts` drena a fila automaticamente e exibe toasts de progresso
- `OfflineBanner` exibe o número de operações pendentes

Operações que suportam offline: `checkin`, `update_atendimento`, `save_vistoria` (sequência completa: create → depositos → sintomas → riscos).

**Limitação:** Web Push (notificações) não funciona no iOS Safari.

---

## Estrutura de arquivos relevante

```
src/
├── App.tsx                    # 58 rotas, providers, guards
├── types/
│   ├── database.ts            # 79 interfaces (1.410 linhas)
│   └── sla.ts                 # SlaOperacional, calcularSlaHoras, SLA_RULES
├── services/
│   └── api.ts                 # 2.831 linhas — 45+ namespaces
├── hooks/
│   ├── useAuth.tsx             # Papel, autenticação, RBAC
│   ├── useClienteAtivo.tsx     # Multitenancy context
│   ├── useOfflineQueue.ts      # Drenagem da fila offline
│   ├── useSlaAlerts.ts         # Alertas de SLA + Web Push
│   └── queries/               # Hooks de query por domínio
├── lib/
│   ├── queryConfig.ts          # Constantes STALE/GC
│   ├── offlineQueue.ts         # Fila IndexedDB
│   ├── webPush.ts              # Subscrição Web Push
│   ├── scoreUtils.ts           # normalizeScore, getScoreConfig
│   └── seedDefault*.ts         # Seeds de configuração por domínio
├── guards/
│   ├── AdminOrSupervisorGuard.tsx
│   └── OperadorGuard.tsx
├── pages/
│   ├── admin/                  # 29+ páginas do portal admin/supervisor/gestor
│   ├── operador/               # Portal do operador de campo
│   ├── agente/                 # Portal do agente de endemias
│   ├── notificador/            # Portal do notificador
│   └── public/                 # Canal cidadão (sem auth)
└── components/
    ├── levantamentos/          # ItemDetailPanel (painel central de foco)
    ├── vistoria/               # Etapas 1–5 do formulário de vistoria
    ├── dashboard/              # Widgets do dashboard
    └── map-v3/                 # Camadas de mapa Leaflet

supabase/
├── migrations/                 # 87+ migrations (.sql)
└── functions/                  # 12 Edge Functions (Deno)
```

---

## Decisões arquiteturais e suas razões

### Por que Supabase e não backend próprio?
Para o estágio atual (< 50 clientes), o Supabase entrega banco, auth, edge functions, storage e realtime em uma única plataforma gerenciada. A camada `api.ts` garante que a dependência está isolada — se for necessário migrar para NestJS/Prisma no futuro, apenas `api.ts` precisa ser reescrito.

### Por que lógica no banco (triggers) em vez de no frontend?
O pipeline Python e as Edge Functions também escrevem dados no banco. Se a lógica estivesse só no frontend, essas escritas externas bypassariam todas as regras. Triggers garantem que a lógica é aplicada **independente de quem escreve**.

### Por que React Query em vez de Zustand/Redux para estado do servidor?
Estado do servidor (dados do banco) tem ciclo de vida diferente de estado local (UI). React Query gerencia cache, stale time, refetch em background e invalidação de forma declarativa, sem boilerplate. O estado local (modais, formulários) usa `useState` e `useReducer` diretamente.

### Por que PostGIS para cruzamentos geoespaciais?
A partir da migration `20260710000000` (focos_risco), o sistema usa índices GIST de geography para cruzamentos de proximidade. Isso substitui a fórmula Haversine pura que existia em algumas queries antigas. PostGIS escala melhor com volume de dados e permite operações como `ST_DWithin` com performance garantida por índice.

---

## Pontos de fragilidade conhecidos

| Fragilidade | Impacto | Localização |
|-------------|---------|-------------|
| `api.ts` com 2.831 linhas sem divisão por domínio | Conflitos de merge, dificuldade de onboarding | `src/services/api.ts` |
| Regra de cálculo de SLA duplicada (TypeScript e PL/pgSQL) | Divergência silenciosa se uma mudança não espelha a outra | `src/types/sla.ts` e função `sla_aplicar_fatores()` |
| Sem testes automatizados | Todo deploy é risco de regressão | Sistema inteiro |
| Pipeline Python sem status visível no painel | Gestores não sabem se o drone está processando ou travado | `levantamentos` (coluna inexistente) |

---

*Documento baseado no código-fonte real. Versão 2.1.0 do sistema, análise em 2026-03-26.*
