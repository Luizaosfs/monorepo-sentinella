# sentinella-frontend

SPA do Sentinella Web — interface para gestores municipais, agentes de campo, notificadores e analistas regionais.

**Stack:** React 18.3 · Vite · TypeScript 5.7 · TanStack Query v5 · React Router v6 · Leaflet 1.9 · Shadcn/Radix UI

---

## Início rápido

```bash
cp .env.example .env   # preencher VITE_API_URL
pnpm install
pnpm dev               # http://localhost:5173
```

## Scripts

| Script | O que faz |
|---|---|
| `pnpm dev` | Dev server Vite |
| `pnpm build` | Build de produção |
| `pnpm preview` | Preview do build |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm lint` | ESLint |

---

## Estrutura src/

```
src/
├── components/
│   ├── admin/           # Gestão da plataforma
│   ├── agente/          # Operação de campo
│   ├── dashboard/       # Painéis analíticos
│   ├── foco/            # Focos de risco
│   ├── gestor/          # Portal do supervisor
│   ├── levantamentos/   # Levantamentos
│   ├── map/             # Mapas Leaflet (v2, v3, dashboard)
│   ├── offline/         # Suporte offline
│   ├── risk-policy/     # Configuração de risco
│   ├── sla/             # SLA operacional
│   ├── vistoria/        # Vistorias de campo
│   └── ui/              # Primitivos Shadcn/Radix
├── guards/              # Route guards (RequireAuth, RequireRole)
├── hooks/
│   ├── queries/         # TanStack Query hooks (useXxx)
│   └── mapa/            # Hooks específicos de mapa
├── lib/                 # queryConfig, offlineQueue, utils
├── pages/
│   ├── admin/           # /admin/* — plataforma
│   ├── agente/          # /agente/*
│   ├── gestor/          # /gestor/*
│   ├── notificador/     # /notificador/*
│   ├── operador/        # /operador/* (alias agente)
│   ├── regional/        # /regional/*
│   └── public/          # /login, /denunciar
├── services/api/        # HTTP service modules por domínio
├── types/               # database.ts, sla.ts, etc.
└── App.tsx              # Roteamento principal
```

---

## API — como fazer chamadas

Usar sempre `@sentinella/api-client`. **Nunca usar `supabase.from()` em código novo.**

```typescript
import { http } from '@sentinella/api-client';

const focos = await http.get('/focos-risco', { params: { clienteId } });
const novo  = await http.post('/focos-risco', body);
await http.put(`/focos-risco/${id}`, patch);
```

## Padrão de hook de query

```typescript
// src/hooks/queries/useFocosRisco.ts
import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';

export function useFocosRisco(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['focos-risco', clienteId],
    queryFn: () => http.get('/focos-risco', { params: { clienteId } }),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM, // LIVE=0 SHORT=1min MEDIUM=3min LONG=10min STATIC=30min
  });
}
```

## Autenticação

- `AuthProvider` envolve a aplicação
- `useAuth()` expõe: `usuario`, `papel`, `isAdmin`, `isSupervisor`, `isAgente`, `isNotificador`, `isAnalistaRegional`
- Login → `POST /auth/login` → access token + refresh token
- Tokens gerenciados por `@sentinella/api-client` (tokenStore)

## Multitenancy

Para obter o `clienteId` ativo, usar sempre:

```typescript
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const { clienteId } = useClienteAtivo();
```

---

## Mapas

Leaflet 1.9.4 com:
- `leaflet-draw` — desenho de polígonos de regiões
- `leaflet-markercluster` — agrupamento de marcadores
- `leaflet.heat` — mapa de calor de focos
- `leaflet-kmz` — importação KMZ

Geometrias de região são recebidas via campo `geojson` (JSON).
O campo `regioes.area` (PostGIS) é populado automaticamente pelo backend a partir do `geojson`.

---

## Portais por papel

| Papel | Rota | Descrição |
|---|---|---|
| `admin` | `/admin/*` | Gestão completa da plataforma |
| `supervisor` | `/gestor/*` | Portal do gestor municipal |
| `agente` / `operador` | `/agente/*` `/operador/*` | Operações de campo |
| `notificador` | `/notificador/*` | Registro de casos UBS |
| `analista_regional` | `/regional/*` | Dashboard multi-municípios |
