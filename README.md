# Sentinella — Monorepo

Plataforma B2G SaaS de vigilância entomológica para prefeituras brasileiras no combate ao Aedes aegypti (dengue/chikungunya/zika).

Combina operação de campo por agentes, análise de imagens por drone/YOLO, notificação de casos via unidades de saúde, canal cidadão de denúncia e dashboards de gestão epidemiológica.

---

## Estrutura

```
monorepo-sentinella/
├── apps/
│   ├── backend/          # API REST — NestJS 11 + Prisma 7 + PostgreSQL 17
│   └── frontend/         # SPA — React 18 + Vite + TanStack Query
├── packages/
│   ├── api-client/       # HTTP client JWT para o frontend
│   └── contracts/        # Schemas Zod compartilhados (DTOs, enums)
├── package.json
└── pnpm-workspace.yaml
```

## Requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20.0.0 |
| pnpm | 9.0.0 |
| PostgreSQL | 17 com PostGIS 3.x |

## Início rápido

```bash
pnpm install

# Backend (porta 3333)
pnpm dev:backend
# → Swagger: http://localhost:3333/api-docs
# → Scalar:  http://localhost:3333/reference

# Frontend (porta 5173)
pnpm dev:frontend
```

## Scripts raiz

| Script | O que faz |
|---|---|
| `pnpm dev:backend` | Backend em modo watch |
| `pnpm dev:frontend` | Frontend Vite |
| `pnpm build` | Build completo (todos os workspaces) |
| `pnpm build:backend` | Build apenas backend |
| `pnpm build:frontend` | Build apenas frontend |
| `pnpm lint` | Lint em todos os workspaces |

---

## Pacotes compartilhados

### `@sentinella/api-client`
HTTP client JWT para o frontend.
Exporta `http` (cliente HTTP com Bearer token) e `tokenStore` (gerenciamento JWT).

### `@sentinella/contracts`
Schemas Zod compartilhados entre frontend e backend.
Garante que DTOs de request/response sejam idênticos nos dois lados.

---

## Perfis do sistema

| Papel | Descrição | Portal |
|---|---|---|
| `admin` | Operador da plataforma SaaS, sem cliente_id, acesso total | `/admin/*` |
| `supervisor` | Gestor municipal | `/gestor/*` |
| `agente` | Agente de campo (= `operador`) | `/agente/*` `/operador/*` |
| `notificador` | Funcionário UBS | `/notificador/*` |
| `analista_regional` | Analista multi-municípios | `/regional/*` |

> `platform_admin` **não existe**. `agente` e `operador` são o **mesmo papel**.

## Multitenancy

Isolamento via `cliente_id` (UUID) em WHERE — não via schema separado.
`TenantGuard` injeta `request.tenantId` a partir do JWT.
Admin pode selecionar tenant via `?clienteId=xxx`.

---

## Módulos principais

- **Focos de risco** — state machine 7 estados, SLA, score territorial, recorrência
- **Vistoria de campo** — stepper 5 etapas, offline-first, depósitos PNCD (A1–E)
- **Canal cidadão** — denúncia pública via QR, protocolo, rate limit
- **Casos notificados** — cruzamento automático caso ↔ foco (PostGIS 300m)
- **Pipeline drone** — YOLO, triagem IA, Cloudinary, evidências
- **SLA operacional** — regras por prioridade, push crítico, auditoria
- **Score territorial** — 13 fatores, calibrável por cliente, cron diário
- **Integração CNES** — sincronização automática de unidades de saúde
- **LIRAa** — IIP/IBP por quarteirão, boletim exportável

---

## Licença

Proprietário — Sentinella. Todos os direitos reservados.
