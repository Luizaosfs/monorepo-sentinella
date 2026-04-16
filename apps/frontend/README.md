# Sentinella

SaaS multi-tenant para prefeituras — monitoramento e combate à dengue.

Combina operação de campo por agentes, análise de imagens por drone/YOLO, notificação de casos via unidades de saúde, canal cidadão de denúncia e dashboards de gestão epidemiológica.

---

## Perfis do sistema

| Papel | Descrição | Rota inicial |
|---|---|---|
| `admin` | Administrador da plataforma (cross-tenant) | `/admin/clientes` |
| `supervisor` | Gestor municipal (admin da prefeitura) | `/gestor/central` |
| `operador` | Agente de campo | `/agente/hoje` |
| `notificador` | Funcionário de unidade de saúde | `/notificador/registrar` |
| cidadão | Denúncia pública sem login | `/denuncia/:slug/:bairroId` |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript + shadcn/ui + Tailwind |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Banco | PostgreSQL com PostGIS, RLS, 83+ tabelas, 152+ funções |
| IA | YOLO (drone), Claude Haiku (triagem/resumo), identify-larva |
| Imagens | Cloudinary |
| Mapas | Leaflet + PostGIS |
| Offline | IndexedDB + fila de sincronização idempotente |
| Push | Web Push VAPID |
| E-mail | Resend |
| Clima | Open-Meteo (gratuito, sem API key) |

---

## Estrutura do projeto

```
src/
├── pages/          # 72 páginas por perfil (admin/, gestor/, operador/, notificador/, public/)
├── components/     # 175 componentes reutilizáveis
├── hooks/          # 76 hooks (queries em hooks/queries/)
├── services/       # api.ts — camada única de acesso ao Supabase
├── types/          # database.ts — todos os tipos do domínio
├── lib/            # utilitários, seeds, helpers de domínio
└── guards/         # guards de rota por papel

supabase/
├── migrations/     # 203 migrations SQL com histórico auditável
├── functions/      # 20 Edge Functions (billing, CNES, IA, push, relatórios...)
└── schema.sql      # Schema completo gerado
```

---

## Módulos principais

- **Vistoria de campo** — stepper 5 etapas, offline-first, depósitos PNCD (A1–E)
- **Focos de risco** — state machine 7 estados, SLA, score territorial, recorrência
- **Canal cidadão** — denúncia pública via QR, protocolo, rate limit
- **Casos notificados** — cruzamento automático caso ↔ foco (PostGIS 300m)
- **LIRAa** — IIP/IBP por quarteirão, boletim exportável
- **Pipeline drone** — YOLO, triagem IA, Cloudinary, evidências
- **Integração CNES** — sincronização automática de unidades de saúde
- **Integração e-SUS Notifica** — envio de casos para vigilância epidemiológica
- **Score territorial** — 13 fatores, calibrável por cliente, cron diário
- **SLA operacional** — regras por prioridade, push crítico, auditoria

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Variáveis de ambiente
cp .env.example .env
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# Rodar localmente
npm run dev
```

---

## Testes

```bash
# Testes unitários
npm run test

# Testes E2E (Playwright)
npm run test:e2e
```

---

## Implantação de nova prefeitura

Siga o checklist em [`IMPLANTACAO.md`](./IMPLANTACAO.md).

---

## Documentos internos

| Arquivo | Conteúdo |
|---|---|
| `IMPLANTACAO.md` | Checklist de onboarding de nova prefeitura |
| `AUDITORIA_EXECUTIVA_FINAL.md` | Auditoria técnica completa do produto |
| `docs/REGRAS_DE_NEGOCIO_OFICIAIS.md` | Invariantes e regras de negócio consolidadas |
| `AUDITORIA_RLS.md` | Auditoria de políticas RLS |
| `AUDITORIA_TECNICA.md` | Análise técnica detalhada |

---

## Licença

Proprietário — Sentinella. Todos os direitos reservados.
