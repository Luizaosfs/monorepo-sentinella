# PADRONIZACAO DE PAPEIS NO FRONTEND — Sentinella Web
> Gerado em: 2026-04-02 | Base: analise estatica de codigo

---

## 1. Diagnostico — Estado atual

### 1.1 Nomes de papeis em uso (realidade fragmentada)

| Onde | Valor usado | Representa |
|---|---|---|
| `useAuth.tsx` — tipo `Papel` | `'admin' \| 'supervisor' \| 'operador' \| 'notificador' \| 'usuario' \| null` | Definicao oficial |
| `useAuth.tsx` — `ROLE_PRIORITY` | `admin, supervisor, moderador, operador, notificador, usuario, cliente` | Inclui aliases |
| `useAuth.tsx` — `normalizePapel()` | Mapeia `platform_admin→admin`, `moderador→supervisor`, `cliente→usuario` | Compat shim |
| `roleRedirect.ts` — `HOME_BY_PAPEL` | `admin, supervisor, operador, notificador` | Sem `usuario` |
| `AppLayout.tsx` — `PAPEL_LABEL` (local) | `admin, supervisor, operador, usuario, notificador` | 5 papeis |
| `src/lib/labels.ts` — `PAPEL_LABEL` | `admin, supervisor, operador, notificador` | 4 papeis, sem `usuario` |
| `AdminUsuarios.tsx` — `PAPEL_LABELS` | Definicao propria (3a copia) | Pode divergir |
| `OperadorUsuarios.tsx` — check inline | `u.papel === 'operador'` | String hardcoded |
| `AdminDistribuicaoQuarteirao.tsx` — check inline | `String(p.papel).toLowerCase() === 'operador'` | String hardcoded |
| Banco de dados — enum `papel_app` | `admin, supervisor, moderador, operador, notificador, usuario, cliente, platform_admin` | Valor morto presente |

**Problema central: `PAPEL_LABEL` esta definido em 3 lugares diferentes com conteudo diferente.**

### 1.2 Rotas — dois sistemas coexistindo

| Prefixo | Para quem | Status | Quantidade de rotas |
|---|---|---|---|
| `/admin/*` | admin + supervisor (isAdminOrSupervisor) | Ativo — nome confuso | ~35 rotas |
| `/gestor/*` | admin + supervisor (isAdminOrSupervisor) | Ativo | 5 rotas |
| `/operador/*` | operador (isOperador) | Ativo + legado | 7 rotas ativas |
| `/agente/*` | operador (isOperador) | Ativo — novo oficial | 3 rotas |
| `/notificador/*` | notificador + admin + supervisor | Ativo | 3 rotas |
| `/supervisor/*` | — | Apenas alias de redirect | 1 alias |
| `/municipio/*` | publico | Ativo | 1 rota publica |
| `/denuncia/*` | publico | Ativo | 2 rotas publicas |

**Problema: `/admin/*` e `/gestor/*` sao o mesmo papel (supervisor+admin). `/operador/*` e `/agente/*` sao o mesmo papel (operador). Quatro prefixos para dois papeis.**

### 1.3 Guards — nomes inconsistentes com funcao real

| Guard | Arquivo | Logica real | Nome semanticamente correto |
|---|---|---|---|
| `ProtectedRoute` | `App.tsx` | Sessao valida | Correto |
| `AdminGuard` | `src/pages/Admin.tsx` | `isAdminOrSupervisor` | Deveria ser `GestorGuard` |
| `AdminOrSupervisorGuard` | `src/guards/` | `isAdminOrSupervisor` | Redundante com AdminGuard |
| `OperadorGuard` | `src/pages/OperadorGuard.tsx` | `isOperador` APENAS | Nome correto, logica restrita demais (bloqueia admin/supervisor) |
| `NotificadorGuard` | `src/guards/` | `notificador` OU `isAdminOrSupervisor` | Correto |

**Problema: `AdminGuard` e `AdminOrSupervisorGuard` fazem exatamente a mesma coisa — dois guards identicos com nomes diferentes.**

### 1.4 Verificacoes de papel inline (espalhadas no codigo)

| Arquivo | Check inline | Problema |
|---|---|---|
| `AppLayout.tsx:203` | `items.filter(item => isAdmin \|\| !item.adminOnly)` | Flag binario: so adminOnly/nao-adminOnly. Sem granularidade para supervisor |
| `AdminClientes.tsx:533,610` | `isAdmin && ...` | Correto — delete/create cliente e admin-only |
| `AdminDrones.tsx:303,346` | `isAdmin && ...` | Correto |
| `AdminOperacoes.tsx:335,407,480` | `isAdmin && ...` | Correto |
| `AdminPluvioRisco.tsx:736` | `isAdmin && ...` | Correto |
| `Operador.tsx:58-59` | `const isOperador = papel === 'operador'` | Duplica logica do AuthContext localmente |
| `OperadorUsuarios.tsx:219` | `u.papel === 'operador'` | String hardcoded sem tipo |
| `AdminDistribuicaoQuarteirao.tsx:74` | `String(p.papel).toLowerCase() === 'operador'` | String hardcoded sem tipo |

### 1.5 Menus por papel

```
admin:
  baseNavItems (Dashboard, Central, Triagem, Focos, Mapa, Levantamentos)
  + TODOS os grupos do sidebar (incluindo adminOnly=true)
  + adminMonitorNavItems (so Dashboard)
  → BUG: adminMonitorNavItems nunca e usado isoladamente

supervisor:
  baseNavItems
  + grupos do sidebar SEM itens adminOnly=true
  → OK, mas supervisor acessa as rotas via URL mesmo sem ver no menu

operador:
  operadorNavItems (Meu Dia, Registrar Vistoria, Minhas Vistorias, Mapa)
  → Correto

notificador:
  notificadorNavItems (Novo Caso, Meus Casos, Consultar Protocolo)
  → Correto

usuario:
  nenhum menu especifico
  → Cai no dashboard sem conteudo
```

---

## 2. Problemas classificados

### CRITICO

**P1: Dois guards com logica identica**
`AdminGuard` e `AdminOrSupervisorGuard` fazem `isAdminOrSupervisor`. Qualquer mudanca na logica precisa ser feita nos dois.

**P2: `adminOnly` binario nao distingue admin de supervisor**
O menu supervisor exibe todos os itens `adminOnly: false`, incluindo paginas que supervisor nao deveria ver (e.g., `/admin/integracoes` que permite alterar API key e-SUS). O controle e feito na UI da pagina com `isAdmin &&` mas nao no menu.

**P3: `PAPEL_LABEL` em 3 lugares com conteudo diferente**
```
src/lib/labels.ts:       { admin, supervisor, operador, notificador } — 4 papeis
AppLayout.tsx:           { admin, supervisor, operador, usuario, notificador } — 5 papeis
AdminUsuarios.tsx:       definicao propria
```
Se um papel for renomeado, precisa atualizar 3 arquivos.

**P4: `/operador` e `/agente` coexistem como prefixos para o mesmo papel**
O operador tem rotas em dois namespaces diferentes. Novos devs nao sabem qual usar.

### ALTO

**P5: `isNotificador` nao existe no `AuthContext`**
`NotificadorGuard` faz `papel === 'notificador'` inline. Se a logica mudar (ex: adicionar `gestor_saude`), precisa atualizar todos os lugares.

**P6: Verificacao de papel por string hardcoded**
`u.papel === 'operador'` e `String(p.papel).toLowerCase() === 'operador'` em paginas de admin. Se o nome do papel mudar, quebra silenciosamente.

**P7: `adminMonitorNavItems` definido mas nunca usado isoladamente**
Existe um array de nav para admin de plataforma focado (`[{ to: '/dashboard' }]`) mas o codigo nunca seleciona esse array — admin recebe `baseNavItems` + todos os grupos.

**P8: `Operador.tsx` deriva `isOperador` localmente**
```typescript
const isOperador = papel === 'operador'; // linha 58 — duplica AuthContext
```
Deveria usar `const { isOperador } = useAuth()`.

**P9: OperadorGuard bloqueia admin e supervisor**
Admin nao consegue acessar `/agente/*` e `/operador/*` para suporte. Intencional mas nao documentado e nao configuravel.

### MEDIO

**P10: Pasta `src/pages/admin/` contem paginas de supervisor**
`AdminSla.tsx`, `AdminLiraa.tsx`, `AdminCasosNotificados.tsx` etc. sao usadas por supervisor, mas o nome da pasta sugere que sao exclusivas de admin.

**P11: `usuario` sem fluxo nem menu**
Papel `usuario` nao tem home definida em `HOME_BY_PAPEL` (fallback e `/dashboard`), nao tem menu especifico, nao tem guard. Usuario autenticado com esse papel fica preso.

**P12: `moderador` e `cliente` no enum do banco mas invisíveis no frontend**
`normalizePapel` os mapeia, mas se o mapeamento falhar (ex: typo no banco), o usuario fica com `usuario` sem perceber.

---

## 3. Padrao proposto

### 3.1 Papeis oficiais

| Papel (codigo) | Label exibido | Home apos login | Descricao |
|---|---|---|---|
| `admin` | Administrador da Plataforma | `/plataforma/clientes` | SaaS — acesso total |
| `supervisor` | Gestor Municipal | `/municipio/central` | Admin da prefeitura |
| `operador` | Agente de Campo | `/agente/hoje` | Vistoria de campo |
| `notificador` | Notificador de Saude | `/notificacao/registrar` | UBS/hospital |
| `usuario` | Visualizador | `/relatorios` | Somente leitura |

**Aliases aceitos (mapeados em `normalizePapel`):**
- `platform_admin` → `admin`
- `moderador` → `supervisor`
- `cliente` → `usuario`

### 3.2 Estrutura de rotas proposta

```
PUBLICO (sem auth):
  /                       Landing page
  /login
  /reset-password
  /trocar-senha
  /install
  /denuncia/:slug/:bairroId    Canal cidadao
  /denuncia/consultar          Consulta publica
  /municipio/:slug             Painel publico

PLATAFORMA (admin):
  /plataforma/clientes         (hoje: /admin/clientes)
  /plataforma/municipios       (hoje: /admin/painel-municipios)
  /plataforma/quotas           (hoje: /admin/quotas)
  /plataforma/drones           (hoje: /admin/drones)
  /plataforma/voos             (hoje: /admin/voos)
  /plataforma/pipeline         (hoje: /admin/pipeline-status)
  /plataforma/saude            (hoje: /admin/saude-sistema)
  /plataforma/jobs             (hoje: /admin/job-queue)
  /plataforma/yolo             (hoje: /admin/yolo-qualidade)
  /plataforma/risk-policy      (hoje: /admin/risk-policy)

MUNICIPIO (supervisor + admin):
  /municipio/central           (hoje: /gestor/central)
  /municipio/triagem           (hoje: /gestor/triagem)
  /municipio/focos             (hoje: /gestor/focos)
  /municipio/focos/:id         (hoje: /gestor/focos/:id)
  /municipio/mapa              (hoje: /gestor/mapa)
  /municipio/planejamentos     (hoje: /admin/planejamentos)
  /municipio/ciclos            (hoje: /admin/ciclos)
  /municipio/operacoes         (hoje: /admin/operacoes)
  /municipio/levantamentos     (hoje: /levantamentos)
  /municipio/imoveis           (hoje: /admin/imoveis)
  /municipio/regioes           (hoje: /admin/regioes)
  /municipio/usuarios          (hoje: /admin/usuarios)
  /municipio/agentes           (hoje: /operador/usuarios)
  /municipio/unidades-saude    (hoje: /admin/unidades-saude)
  /municipio/sla               (hoje: /admin/sla)
  /municipio/liraa             (hoje: /admin/liraa)
  /municipio/casos             (hoje: /admin/casos)
  /municipio/canal-cidadao     (hoje: /admin/canal-cidadao)
  /municipio/integracoes       (hoje: /admin/integracoes)
  /municipio/score-surto       (hoje: /admin/score-surto)
  /municipio/supervisor        (hoje: /admin/supervisor-tempo-real)
  /municipio/produtividade     (hoje: /admin/produtividade-agentes)
  /municipio/eficacia          (hoje: /admin/eficacia-tratamentos)
  /municipio/executivo         (hoje: /admin/executivo)
  ...

AGENTE (operador):
  /agente/hoje                 (ja existe)
  /agente/vistoria/:imovelId   (ja existe)
  /agente/imoveis/:id          (ja existe)
  /agente/levantamentos        (hoje: /operador/levantamentos)
  /agente/mapa                 (hoje: /operador/mapa)
  /agente/rota                 (hoje: /operador/rota)

NOTIFICACAO (notificador + supervisor + admin):
  /notificacao/registrar       (hoje: /notificador/registrar)
  /notificacao/casos           (hoje: /notificador)
  /notificacao/consultar       (hoje: /notificador/consultar)

RELATORIOS (usuario — somente leitura):
  /relatorios/dashboard        (hoje: /dashboard)
  /relatorios/mapa             (alias para /municipio/mapa readonly)
```

### 3.3 Guards propostos

```typescript
// Hierarquia clara: 5 guards, sem sobreposicao

ProtectedRoute          // qualquer sessao valida
  PlataformaGuard       // isAdmin APENAS
  MunicipioGuard        // isAdmin || isSupervisor
  AgenteGuard           // isOperador APENAS (ou isAdmin para debug?)
  NotificacaoGuard      // isNotificador || isAdmin || isSupervisor
  VisualizadorGuard     // qualquer autenticado (usuario viewer)
```

---

## 4. Arquivo `roles.ts` proposto

**Caminho: `src/lib/roles.ts`**

Este arquivo centraliza TODA a logica de papeis. Nenhum outro arquivo deve definir strings de papel, labels ou prioridades.

```typescript
// src/lib/roles.ts
// FONTE UNICA DE VERDADE para papeis no frontend Sentinella.

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Papel =
  | 'admin'       // Administrador da Plataforma SaaS
  | 'supervisor'  // Gestor Municipal (admin da prefeitura)
  | 'operador'    // Agente de Campo
  | 'notificador' // Notificador de Saude (UBS/hospital)
  | 'usuario';    // Visualizador (somente leitura)

// Aliases aceitos do banco — mapeados em normalizePapel()
type PapelAlias = 'platform_admin' | 'moderador' | 'cliente';

// ─── Normalizacao ────────────────────────────────────────────────────────────

export function normalizePapel(raw: string | null | undefined): Papel {
  const s = (raw ?? '').toLowerCase().trim();
  if (s === 'admin' || s === 'platform_admin') return 'admin';
  if (s === 'supervisor' || s === 'moderador')  return 'supervisor';
  if (s === 'operador')                          return 'operador';
  if (s === 'notificador')                       return 'notificador';
  return 'usuario'; // fallback seguro
}

// ─── Prioridade (maior = mais privilegiado) ──────────────────────────────────

export const PAPEL_PRIORITY: Record<string, number> = {
  admin:       5,
  supervisor:  4,
  moderador:   4, // alias
  operador:    3,
  notificador: 2,
  usuario:     1,
  cliente:     1, // alias
};

// ─── Labels de exibicao ──────────────────────────────────────────────────────

export const PAPEL_LABEL: Record<Papel, string> = {
  admin:       'Administrador da Plataforma',
  supervisor:  'Gestor Municipal',
  operador:    'Agente de Campo',
  notificador: 'Notificador de Saude',
  usuario:     'Visualizador',
};

// ─── Home por papel (apos login) ─────────────────────────────────────────────

export const HOME_BY_PAPEL: Record<Papel, string> = {
  admin:       '/plataforma/clientes',
  supervisor:  '/municipio/central',
  operador:    '/agente/hoje',
  notificador: '/notificacao/registrar',
  usuario:     '/relatorios',
};

export function getHomeByPapel(papel: Papel | null | undefined): string {
  return HOME_BY_PAPEL[papel ?? 'usuario'] ?? '/dashboard';
}

// ─── Helpers de verificacao ──────────────────────────────────────────────────

export function isAdminPapel(p: Papel | null)      { return p === 'admin'; }
export function isSupervisorPapel(p: Papel | null) { return p === 'supervisor'; }
export function isOperadorPapel(p: Papel | null)   { return p === 'operador'; }
export function isNotificadorPapel(p: Papel | null){ return p === 'notificador'; }

export function isGestorPapel(p: Papel | null) {
  return p === 'admin' || p === 'supervisor';
}

// ─── Papeis que podem realizar cada acao ─────────────────────────────────────

export const PAPEIS_GESTAO     = ['admin', 'supervisor'] as const;
export const PAPEIS_CAMPO      = ['admin', 'supervisor', 'operador'] as const;
export const PAPEIS_SAUDE      = ['admin', 'supervisor', 'notificador'] as const;
export const PAPEIS_PLATAFORMA = ['admin'] as const;
```

---

## 5. Sistema de guards proposto

**Caminho: `src/guards/index.tsx`**

```typescript
// src/guards/index.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Spinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

type Props = { children: React.ReactNode };

/** Qualquer usuario autenticado com sessao valida. */
export const ProtectedRoute = ({ children }: Props) => {
  const { session, loading, mustChangePassword } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <>{children}</>;
};

/** Somente admin da plataforma. */
export const PlataformaGuard = ({ children }: Props) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdmin) return <Navigate to="/municipio/central" replace />;
  return <>{children}</>;
};

/** Admin da plataforma OU gestor municipal (supervisor). */
export const MunicipioGuard = ({ children }: Props) => {
  const { isAdminOrSupervisor, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdminOrSupervisor) return <Navigate to="/agente/hoje" replace />;
  return <>{children}</>;
};

/** Somente agente de campo (operador).
 *  Admin/supervisor sao redirecionados para seu espaco. */
export const AgenteGuard = ({ children }: Props) => {
  const { isOperador, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isOperador) return <Navigate to="/municipio/central" replace />;
  return <>{children}</>;
};

/** Notificador de saude OU admin/supervisor (podem registrar casos tambem). */
export const NotificacaoGuard = ({ children }: Props) => {
  const { isNotificador, isAdminOrSupervisor, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isNotificador && !isAdminOrSupervisor) return <Navigate to="/agente/hoje" replace />;
  return <>{children}</>;
};

/** Qualquer usuario autenticado — somente leitura. */
export const VisualizadorGuard = ({ children }: Props) => {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
```

**Nota:** `isNotificador` precisa ser adicionado ao `AuthContext`:
```typescript
// Em useAuth.tsx — adicionar:
const isNotificador = papel === 'notificador';
// Expor no context value e no AuthContextType
```

---

## 6. Atualizacao do AuthContext

**Mudancas necessarias em `src/hooks/useAuth.tsx`:**

```typescript
// 1. Importar tipos do novo roles.ts
import { Papel, normalizePapel, PAPEL_PRIORITY } from '@/lib/roles';

// 2. Adicionar isNotificador ao tipo e valor
interface AuthContextType {
  // ... existentes ...
  isNotificador: boolean;        // ADICIONAR
}

// 3. Derivar isNotificador
const isNotificador = papel === 'notificador';

// 4. Expor no Provider value
// ... isNotificador ...

// 5. Remover ROLE_PRIORITY local (usar PAPEL_PRIORITY de roles.ts)
// 6. Remover normalizePapel local (usar de roles.ts)
```

---

## 7. Plano de migracao de rotas

### Fase 1 — Aliases (sem quebrar nada, 1 dia)

Adicionar redirects em `App.tsx` para as novas rotas, mantendo as antigas funcionando:

```typescript
// Novas rotas canonicas — aliases para as existentes
<Route path="/plataforma/clientes"   element={<Navigate to="/admin/clientes" replace />} />
<Route path="/municipio/central"     element={<Navigate to="/gestor/central" replace />} />
<Route path="/municipio/focos"       element={<Navigate to="/gestor/focos" replace />} />
<Route path="/municipio/mapa"        element={<Navigate to="/gestor/mapa" replace />} />
<Route path="/notificacao/registrar" element={<Navigate to="/notificador/registrar" replace />} />
<Route path="/notificacao/casos"     element={<Navigate to="/notificador" replace />} />
<Route path="/relatorios"            element={<Dashboard />} />
```

Atualizar `HOME_BY_PAPEL` para apontar para novas URLs:
```typescript
admin:       '/plataforma/clientes',
supervisor:  '/municipio/central',
operador:    '/agente/hoje',         // ja correto
notificador: '/notificacao/registrar',
usuario:     '/relatorios',
```

### Fase 2 — Mover rotas `/admin/*` plataforma para `/plataforma/*` (2-3 dias)

Rotas que devem mover E ter guard trocado para `PlataformaGuard`:
```
/admin/clientes          → /plataforma/clientes
/admin/painel-municipios → /plataforma/municipios
/admin/quotas            → /plataforma/quotas
/admin/drones            → /plataforma/drones
/admin/voos              → /plataforma/voos
/admin/pipeline-status   → /plataforma/pipeline
/admin/saude-sistema     → /plataforma/saude
/admin/job-queue         → /plataforma/jobs
/admin/yolo-qualidade    → /plataforma/yolo
/admin/risk-policy       → /plataforma/risk-policy
```

### Fase 3 — Mover `/gestor/*` e `/admin/*` municipio para `/municipio/*` (3-5 dias)

```
/gestor/central   → /municipio/central
/gestor/triagem   → /municipio/triagem
/gestor/focos     → /municipio/focos
/admin/casos      → /municipio/casos
/admin/planejamentos → /municipio/planejamentos
...etc
```

### Fase 4 — Limpar rotas legadas `/operador/*` (1 dia)

```
/operador/inicio              → remover (ja redireciona para /agente/hoje)
/operador/levantamentos       → /agente/levantamentos (mover)
/operador/mapa                → /agente/mapa (mover)
/operador/rota                → /agente/rota (mover)
/operador/vistoria/:id        → remover (ja redireciona para /agente/vistoria/:id)
/operador/imoveis             → remover ou mover para /agente/imoveis
/operador/levantamentos/novo-item → /agente/levantamentos/novo-item (mover)
```

Manter por 1 versao como `<Navigate replace />` antes de remover.

---

## 8. Limpeza de codigo proposta

### 8.1 Consolidar PAPEL_LABEL

Remover definicoes duplicadas e importar de `roles.ts`:

```typescript
// REMOVER de AppLayout.tsx (linhas 185-191):
const PAPEL_LABEL: Record<string, string> = { ... }; // APAGAR

// REMOVER de AdminUsuarios.tsx:
const PAPEL_LABELS: Record<PapelUsuario, string> = { ... }; // APAGAR

// ADICIONAR import em ambos:
import { PAPEL_LABEL } from '@/lib/roles';
```

### 8.2 Eliminar strings hardcoded de papel

```typescript
// ANTES (OperadorUsuarios.tsx:219):
u.papel === 'operador'

// DEPOIS:
import { isOperadorPapel } from '@/lib/roles';
isOperadorPapel(u.papel)

// ANTES (AdminDistribuicaoQuarteirao.tsx:74):
String(p.papel).toLowerCase() === 'operador'

// DEPOIS:
import { normalizePapel } from '@/lib/roles';
normalizePapel(p.papel) === 'operador'
```

### 8.3 Corrigir derivacao local de isOperador

```typescript
// ANTES (Operador.tsx:58):
const isOperador = papel === 'operador'; // derivacao local

// DEPOIS:
const { isOperador } = useAuth(); // usar do contexto
```

### 8.4 Remover guard duplicado

```typescript
// AdminOrSupervisorGuard e AdminGuard sao identicos.
// Manter apenas MunicipioGuard (novo nome).
// Substituir todas as referencias a AdminOrSupervisorGuard e AdminGuard
// pelo novo MunicipioGuard.
```

### 8.5 Adicionar flag `supervisorOnly` no menu (opcional)

```typescript
// Hoje o menu so tem adminOnly: boolean
// Proposta: adicionar supervisorOnly (exibe para supervisor mas nao para admin-plataforma)
// e plataformaOnly (exibe apenas para admin da plataforma)

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  plataformaOnly?: boolean; // antes: adminOnly
  supervisorOnly?: boolean; // novo
}
```

---

## 9. Checklist de implementacao

### Obrigatorio antes de producao

- [ ] Criar `src/lib/roles.ts` com tipo `Papel`, `PAPEL_LABEL`, `HOME_BY_PAPEL`, `normalizePapel`, helpers
- [ ] Remover `normalizePapel` e `ROLE_PRIORITY` de `useAuth.tsx`, importar de `roles.ts`
- [ ] Adicionar `isNotificador` ao `AuthContext` (tipo + valor + provider)
- [ ] Consolidar `PAPEL_LABEL` — remover duplicatas em `AppLayout.tsx` e `AdminUsuarios.tsx`
- [ ] Corrigir `get_meu_papel()` no banco (adicionar `notificador` ao CASE)
- [ ] Adicionar `/operador/rota` ao `OPERADOR_ALLOWED_PATHS` em `AppLayout.tsx`

### Recomendado (melhora mantenabilidade)

- [ ] Criar guards padronizados em `src/guards/index.tsx`
- [ ] Substituir `AdminGuard` + `AdminOrSupervisorGuard` por `MunicipioGuard`
- [ ] Eliminar strings hardcoded `'operador'` em `OperadorUsuarios.tsx` e `AdminDistribuicaoQuarteirao.tsx`
- [ ] Corrigir `Operador.tsx` — usar `isOperador` do AuthContext ao inves de derivar localmente
- [ ] Criar tela `/relatorios` para usuario viewer (ou redirecionar para dashboard com conteudo restrito)
- [ ] Documentar em comentario no codigo que `OperadorGuard` bloqueia admin intencionalmente

### Migracao de rotas (pode ser feito incremetalmente)

- [ ] Fase 1: Aliases `/plataforma/*`, `/municipio/*`, `/notificacao/*`, `/relatorios`
- [ ] Fase 2: Mover rotas de plataforma para `/plataforma/*` + trocar guard para `PlataformaGuard`
- [ ] Fase 3: Mover rotas municipais de `/admin/*` + `/gestor/*` para `/municipio/*`
- [ ] Fase 4: Remover rotas legadas `/operador/*` (manter como Navigate por 1 ciclo)

---

## 10. Mapa de impacto por arquivo

| Arquivo | Mudancas necessarias |
|---|---|
| `src/lib/roles.ts` | CRIAR (novo arquivo central) |
| `src/hooks/useAuth.tsx` | Importar de roles.ts; adicionar isNotificador |
| `src/lib/roleRedirect.ts` | Substituir por re-export de roles.ts |
| `src/lib/labels.ts` | Mover PAPEL_LABEL para roles.ts; re-exportar |
| `src/components/AppLayout.tsx` | Remover PAPEL_LABEL local; importar roles.ts; adicionar flag plataformaOnly |
| `src/pages/Admin.tsx` | Renomear para MunicipioGuard ou remover |
| `src/guards/AdminOrSupervisorGuard.tsx` | Substituir por MunicipioGuard |
| `src/guards/NotificadorGuard.tsx` | Usar isNotificador do context |
| `src/pages/OperadorGuard.tsx` | Mover para src/guards/; renomear para AgenteGuard |
| `src/App.tsx` | Atualizar imports de guards; adicionar rotas novas; adicionar aliases |
| `src/pages/Operador.tsx` | Usar isOperador do AuthContext |
| `src/pages/operador/OperadorUsuarios.tsx` | Usar normalizePapel de roles.ts |
| `src/pages/admin/AdminDistribuicaoQuarteirao.tsx` | Usar normalizePapel de roles.ts |
| `src/pages/admin/AdminUsuarios.tsx` | Remover PAPEL_LABELS local; importar roles.ts |
| `src/lib/roleRedirect.ts` | Substituir logica por import de roles.ts |
| `supabase/migrations/NOVO_get_meu_papel_fix.sql` | Adicionar notificador ao CASE ordering |
