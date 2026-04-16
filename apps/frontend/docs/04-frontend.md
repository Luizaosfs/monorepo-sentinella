# 04 — Frontend

> **Para quem é este documento:** desenvolvedores que precisam entender a estrutura de páginas, componentes, hooks e estado do Sentinella Web, incluindo os problemas de responsabilidade mista e arquivos grandes encontrados.

---

## Stack e organização geral

| Tecnologia | Uso |
|-----------|-----|
| React 18 | Framework de UI |
| TypeScript (strict) | Linguagem |
| Vite | Build e dev server |
| React Router v6 | Roteamento |
| TanStack React Query v5 | Estado do servidor (cache + fetch) |
| Tailwind CSS + shadcn/ui | Estilo e componentes base |
| Radix UI | Primitivos acessíveis (via shadcn) |
| Leaflet / React Leaflet | Mapas interativos |

---

## Estrutura de arquivos

```
src/
├── App.tsx                    # Ponto de entrada — 232 linhas, 58 rotas
├── pages/
│   ├── Admin.tsx              # Guard wrapper do portal admin
│   ├── Dashboard.tsx          # Página principal pós-login
│   ├── Login.tsx
│   ├── Operador.tsx           # Guard wrapper do portal operador (612 linhas)
│   ├── admin/                 # 29 páginas do portal administrativo
│   ├── operador/              # 8 páginas do portal de campo
│   ├── agente/                # Portal do agente de endemias
│   ├── notificador/           # Portal do notificador
│   └── public/                # Páginas sem autenticação
├── components/
│   ├── AppLayout.tsx          # Layout principal com sidebar (1.045 linhas)
│   ├── AdminPageHeader.tsx    # Cabeçalho padrão de páginas admin
│   ├── ErrorBoundary.tsx
│   ├── OfflineBanner.tsx
│   ├── QuotaBanner.tsx
│   ├── admin/                 # Componentes específicos do admin
│   ├── dashboard/             # Widgets do dashboard
│   ├── foco/                  # Componentes de focos_risco
│   ├── layouts/               # PublicLayout, etc.
│   ├── levantamentos/         # ItemDetailPanel (painel central)
│   ├── map/                   # Mapas Leaflet
│   ├── map-v3/                # Camadas de mapa (versão 3)
│   ├── ui/                    # shadcn/ui — componentes base
│   └── vistoria/              # Etapas 1–5 do formulário de vistoria
├── hooks/
│   ├── useAuth.tsx            # Autenticação e RBAC
│   ├── useClienteAtivo.tsx    # Multitenancy context
│   ├── useOfflineQueue.ts     # Drenagem da fila offline
│   ├── useOfflineStatus.ts    # Detecta perda de conexão
│   ├── useSlaAlerts.ts        # Alertas de SLA crítico + Web Push
│   ├── use-mobile.tsx         # useIsMobile() — breakpoint 768px
│   ├── mapa/                  # Hooks específicos de mapa (realtime)
│   └── queries/               # 30+ hooks de query por domínio
├── guards/
│   ├── AdminOrSupervisorGuard.tsx
│   └── OperadorGuard.tsx
├── services/
│   └── api.ts                 # 2.831 linhas — camada de serviço
├── types/
│   ├── database.ts            # 79 interfaces (1.410 linhas)
│   └── sla.ts                 # Tipos e funções de SLA
└── lib/
    ├── queryConfig.ts         # Constantes STALE/GC
    ├── offlineQueue.ts        # Fila IndexedDB
    ├── webPush.ts             # Web Push
    ├── scoreUtils.ts          # Normalização de score YOLO
    ├── sinan.ts               # Integração e-SUS Notifica
    └── seedDefault*.ts        # Seeds de configuração
```

---

## Roteamento e portais

### Estrutura de rotas (App.tsx — 232 linhas, 58 rotas)

O `App.tsx` define toda a árvore de rotas com lazy loading via `React.lazy`. Cada página é carregada apenas quando acessada, usando um `safeLazy` customizado que protege contra módulos que não exportam componente válido.

```
/login                    — pública, sem auth
/reset-password           — pública
/trocar-senha             — pública (link por email)
/install                  — pública (PWA install page)
/denuncia/:slug/:bairroId — pública (Canal Cidadão)
/denuncia/consultar       — pública

/ (Dashboard)             — autenticado, qualquer papel

/admin/...                — AdminOrSupervisorGuard (admin ou supervisor)
  /planejamentos
  /levantamentos           ← rota sem subrotas explícitas no arquivo
  /drones
  /voos
  /regioes
  /usuarios
  /clientes                ← só admin (não supervisor)
  /risk-policy
  /sla
  /sla/feriados
  /sla/regioes
  /operacoes
  /historico-atendimento
  /pluvio-risco
  /pluvio-operacional
  /heatmap-temporal
  /mapa-comparativo
  /casos-notificados
  /unidades-saude
  /imoveis
  /imoveis-problematicos
  /canal-cidadao
  /quotas
  /plano-acao-catalogo
  /painel-municipios
  /liraa
  /distribuicao-quarteirao
  /produtividade-agentes
  /integracoes
  /relatorio-semanal

/operador/...             — OperadorGuard
  /inicio
  /atendimento
  /mapa
  /item/:id
  /evidencias/:id
  /imoveis
  /vistoria/:imovelId
  /novo-item-manual

/agente/...               — OperadorGuard
  /hoje
  /vistoria/:imovelId

/notificador/...
  /registrar

/supervisor/...
  /relatorio-semanal
```

### Provider hierarchy

```
QueryClientProvider
  TooltipProvider
    AuthProvider        ← autenticação JWT, papel, perfil
      ClienteAtivoProvider  ← multitenancy, seleção de prefeitura
        BrowserRouter
          Routes (58 rotas)
```

---

## Os arquivos mais grandes e por quê

| Arquivo | Linhas | Motivo do tamanho |
|---------|--------|-------------------|
| `src/services/api.ts` | 2.831 | Todos os namespaces de acesso ao banco sem divisão |
| `src/types/database.ts` | 1.410 | 79 interfaces de domínio sem divisão por módulo |
| `AdminPluvioOperacional.tsx` | 1.088 | Página complexa com múltiplos painéis, filtros, mapa e lógica de risco |
| `AppLayout.tsx` | 1.045 | Layout geral com sidebar, navegação por papel, badges e lógica de responsividade |
| `AdminUnidadesSaude.tsx` | 886 | CRUD + painel CNES + accordion histórico de sync |
| `AdminPluvioRisco.tsx` | 765 | Visualização de risco pluvial com múltiplos gráficos |
| `AdminSla.tsx` | 764 | Painel de SLA com timeline, filtros, auditoria e ações |
| `AdminVoos.tsx` | 753 | CRUD de voos + condições meteorológicas |
| `OperadorNovoItemManual.tsx` | 752 | Formulário de item manual com geocodificação |
| `AdminImoveis.tsx` | 704 | CRUD + filtros + perfil + mapa de imóveis |
| `ItemDetailPanel.tsx` | 692 | Painel detalhado de foco (score YOLO, casos próximos, timeline SLA, voz) |
| `AppLayout.tsx` | 1.045 | Layout com sidebar responsivo + lógica por papel |

---

## Portal admin — páginas e responsabilidades

### Gestão operacional
- `AdminPlanejamentos` — CRUD de planejamentos, badge de imóveis para drone
- `AdminOperacoes` — lista de operações de atendimento com filtros
- `AdminHistoricoAtendimento` — linha do tempo de atendimentos por item
- `AdminSla` — painel SLA completo (764 linhas)

### Análise e visualização
- `AdminPluvioRisco` — score de risco por bairro/região (765 linhas)
- `AdminPluvioOperacional` — módulo operacional pluvial (1.088 linhas — o maior)
- `AdminHeatmapTemporal` — heatmap animado com slider temporal
- `AdminMapaComparativo` — comparação A/B de dois levantamentos

### Módulo de campo
- `AdminImoveis` — cadastro de imóveis (704 linhas)
- `AdminImoveisProblematicos` — imóveis com acesso negado, prioridade drone
- `AdminCasosNotificados` — painel de casos de dengue notificados

### Infraestrutura
- `AdminClientes` — só para papel admin (todas as prefeituras)
- `AdminUsuarios` — gestão de usuários da prefeitura
- `AdminRegioes` — regiões geográficas
- `AdminUnidadesSaude` — UBS/UPA/hospital + sync CNES (886 linhas)
- `AdminQuotas` — controle de uso

### Configuração
- `AdminRiskPolicy` — política de risco pluvial
- `AdminPlanoAcaoCatalogo` — catálogo de planos de ação
- `AdminSlaFeriados` / `AdminSlaRegioes` — configuração de SLA
- `AdminIntegracoes` — e-SUS Notifica

---

## Portal operador — estrutura de navegação

O portal operador tem dois fluxos principais que se sobrepõem no `OperadorGuard`:

```
/operador/inicio           → OperadorInicioTurno (stats do ciclo, seleção de atividade)
/operador/atendimento      → Operador.tsx (612 linhas — lista de focos para atender)
/operador/mapa             → OperadorMapa (mapa com rota TSP otimizada)
/operador/item/:id         → OperadorItemDetalhe
/operador/evidencias/:id   → OperadorEvidencias
/operador/imoveis          → OperadorListaImoveis (626 linhas)
/operador/vistoria/:id     → OperadorFormularioVistoria (stepper 5 etapas)
/operador/novo-item-manual → OperadorNovoItemManual (752 linhas)
```

**Nota:** `Operador.tsx` (612 linhas) é um arquivo de página, não apenas guard. Contém a lógica de listagem de focos do operador e filtragem.

---

## Hooks de query — catálogo

Todos os hooks de dados ficam em `src/hooks/queries/`. Seguem o padrão:
- Recebem `clienteId` como parâmetro
- Usam `enabled: !!clienteId` para não disparar sem contexto
- Usam constante `STALE.*` do `queryConfig.ts`

| Hook | Descrição | STALE |
|------|-----------|-------|
| `useFocosRisco` | Lista focos de risco ativos | SHORT |
| `useLevantamentos` | Levantamentos do cliente | MEDIUM |
| `useLevantamentoItens` | Itens de um levantamento | MEDIUM |
| `useItensOperador` | Focos atribuídos ao operador | SHORT |
| `useItensPorPeriodo` | Itens em período de tempo | MODERATE |
| `useCasosNotificados` | Casos de dengue notificados | RECENT |
| `useUnidadesSaude` | UBS/UPA/hospitais | MAP |
| `useImoveis` | Imóveis cadastrados | MAP |
| `useImoveisProblematicos` | Imóveis com acesso negado | MEDIUM |
| `useVistorias` | Vistorias de campo | SHORT |
| `useSlaData` / `useSlaIminentes` | SLA operacional | VERY_SHORT |
| `usePluvioRisco` | Risco pluviométrico | MODERATE |
| `useCnesSyncControle` | Status sync CNES (polling 5s se em andamento) | VERY_SHORT |
| `useAnaliseIa` | Análise IA pós-voo | STATIC |
| `useComparativoMunicipios` | KPIs entre municípios | MODERATE |
| `useDistribuicaoQuarteirao` | Distribuição LIRAa | MEDIUM |
| `useAlertasRetorno` | Imóveis com alerta de retorno | SHORT |
| `useMapaFocosRealtime` | Focos em tempo real no mapa | LIVE |

---

## Hooks de estado global

| Hook | Responsabilidade |
|------|-----------------|
| `useAuth` | Autenticação, papel, `isAdmin`, `isAdminOrSupervisor`, `isOperador` |
| `useClienteAtivo` | `clienteId` ativo, lista de clientes (admin), seleção persistida |
| `useOfflineStatus` | Detecta perda de conexão |
| `useOfflineQueue` | Drena fila offline ao reconectar |
| `useSlaAlerts` | Monitora SLAs críticos, auto-subscribe para Web Push |
| `use-mobile` | `useIsMobile()` para responsividade (breakpoint 768px) |

---

## Componentes importantes

### `AppLayout.tsx` (1.045 linhas)
O layout principal do sistema. Renderiza:
- Sidebar com navegação diferenciada por papel
- Badges de contagem (SLAs vencidos, quota, pendentes offline)
- `QuotaBanner` (uso acima de 70%)
- `OfflineBanner` (operações pendentes de sync)
- Lógica de collapse/responsividade

**Fragilidade:** com 1.045 linhas, mistura responsabilidades de navegação, estado global de alertas e layout visual. Difícil de modificar sem introduzir regressões.

### `ItemDetailPanel.tsx` (692 linhas)
O componente mais complexo do sistema. Exibe para um foco de risco:
- Score YOLO com barra de progresso e cor semântica
- Banner de casos notificados em 300m (expansível)
- Timeline de auditoria (criado → em_atendimento → resolvido)
- Botão "Não confirmado" (falso positivo → `yolo_feedback`)
- Comandos de voz ("marcar como resolvido", "próximo item")
- Botão "Notificar ao e-SUS"

**Fragilidade:** demasiadas responsabilidades em um único componente. Acumula UI, side effects (voz, push), integrações (e-SUS) e lógica de negócio (conversão de status).

### `OperadorNovoItemManual.tsx` (752 linhas)
Formulário com geocodificação Google Maps, validação manual e criação de `levantamento_item` com origem `MANUAL`. Contém lógica de geocodificação inline.

---

## Problemas de responsabilidade mista identificados

### Problema 1: AdminSla.tsx acessa supabase diretamente
**Observado:** `import { supabase } from '@/lib/supabase'` na linha 5 de `AdminSla.tsx`.

Isso viola a regra fundamental do projeto. A query feita diretamente aqui não passa pelo `api.ts` e não tem as garantias de filtragem por `cliente_id` auditadas centralmente. Se a regra de filtro mudar, essa query não será atualizada junto.

### Problema 2: Lógica de SLA no frontend vai além da exibição
`src/types/sla.ts` contém `calcularSlaHoras()` — uma função que replica a lógica de `sla_aplicar_fatores()` do banco. O arquivo é importado em componentes que precisam estimar prazos antes de consultar o banco. Isso cria dois cálculos que podem divergir.

### Problema 3: Normalização de score YOLO duplicada
Antes da criação de `scoreUtils.ts`, a função `normalizeScore` estava inline em múltiplos componentes. O padrão estabelece centralizar em `scoreUtils.ts`, mas código legado pode ainda ter cópias locais.

### Problema 4: ItemDetailPanel com responsabilidades demais
692 linhas cobrindo score, casos, timeline, voz, e-SUS, falso positivo. Cada responsabilidade deveria ser um componente separado. A complexidade atual torna difícil testar ou modificar qualquer parte isoladamente.

### Problema 5: Operador.tsx (612 linhas) é guard + página
O arquivo `src/pages/Operador.tsx` combina a lógica de guarda de rota com a lógica da página de listagem de focos do operador. A separação seria mais clara com um componente de página separado.

---

## Experiência por perfil — observações

### Operador de campo
- Fluxo móvel-first bem implementado (stepper 5 etapas, GPS checkin, offline)
- `OperadorMapa.tsx` tem algoritmo TSP nearest-neighbor para rota otimizada — lógica algorítmica no componente de página
- Sem tela de carregamento explícita durante drain da fila offline (usuário pode não saber que dados estão sincronizando)

### Gestor / Supervisor
- `AdminPluvioOperacional.tsx` (1.088 linhas) é a página mais complexa — mistura gráficos, mapas, filtros e ações em uma só tela
- Nenhuma das páginas admin tem proteção por papel granular além do guard de rota: um supervisor vê todas as páginas admin, incluindo páginas que conceptualmente seriam só para admin (ex: `AdminClientes`)

### Notificador
- Portal simples (uma página) mas bem implementado com aviso LGPD

### Cidadão
- `DenunciaCidadao.tsx` funciona sem auth via RPC com SECURITY DEFINER — correto e seguro

---

## Lazy loading e performance

Todas as páginas usam `safeLazy` (wrapper de `React.lazy`). O carregamento inicial é leve — apenas o bundle mínimo necessário para o login. Cada rota carrega seu chunk sob demanda.

**Ponto de atenção:** `AppLayout.tsx` (1.045 linhas) é carregado para todos os usuários autenticados. Se ele crescer mais, pode impactar o tempo de carregamento pós-login.

### Otimizações de mapa (QW-08)

**`HeatmapLayer.tsx`** filtra pontos pelo viewport atual antes de renderizar:
- `useMapEvents` escuta `moveend` e `zoomend` para atualizar os bounds
- `useMemo` só recomputa os pontos quando os bounds ou os items mudam
- Padding de 20% evita que itens na borda desapareçam ao mover levemente o mapa
- Antes: renderizava todos os pontos mesmo quando fora da tela

**`api.map.fullDataByCliente`** tem limite de 2.000 itens:
- `ORDER BY data_hora DESC LIMIT 2000` — retorna os itens mais recentes por levantamento
- Combinado com viewport filtering no HeatmapLayer, cobre qualquer visualização prática
- Antes: sem limite — risco de carregar histórico completo em clientes com muitos levantamentos

---

## Offline — como funciona no frontend

**`src/lib/offlineQueue.ts`** implementa uma fila IndexedDB com:
- 3 tipos de operação: `checkin`, `update_atendimento`, `save_vistoria`
- Versão 2 do schema IndexedDB (índice `por_createdAt` para FIFO eficiente)
- `save_vistoria` executa sequência completa: create → addDeposito → addSintomas → addRiscos

**`src/hooks/useOfflineQueue.ts`** drena a fila ao detectar reconexão. Exibe toasts de progresso.

**`OfflineBanner`** mostra contagem de operações pendentes no topo de todas as páginas autenticadas.

**Integração com `update_atendimento`:** a fila já contempla o novo modelo — usa `api.focosRisco.transicionar` quando o item tem `foco_risco_id`, com fallback para `api.itens.updateAtendimento` (legado).

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
