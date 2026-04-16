# VERDADE FUNCIONAL DO SISTEMA — Sentinella Web
> Gerado em: 2026-04-02 | Base: análise estática de código + migrations SQL

---

## 1. Papéis existentes

### Enum `papel_app` no banco (PostgreSQL)

| Valor no banco | Status | Mapeamento no frontend |
|---|---|---|
| `admin` | **Ativo** | `admin` |
| `supervisor` | **Ativo** | `supervisor` |
| `moderador` | Ativo (alias de supervisor) | `supervisor` (via `normalizePapel`) |
| `operador` | **Ativo** | `operador` |
| `notificador` | **Ativo** | `notificador` |
| `usuario` | Ativo (fallback) | `usuario` |
| `cliente` | Legado (alias de usuario) | `usuario` (via `normalizePapel`) |
| `platform_admin` | **REMOVIDO** (migration 20260910) | `admin` (compat shim em `normalizePapel`) |

### Hierarquia de prioridade

```
admin (5) > supervisor/moderador (4) > operador (3) > notificador (2) > usuario/cliente (1)
```

Definida em dois lugares:
- **Frontend**: `ROLE_PRIORITY` em `useAuth.tsx`
- **Banco**: CASE ordering na função `get_meu_papel()`

> BUG: `get_meu_papel()` nao inclui `notificador` no CASE (cai em ELSE 0).
> Se um usuario tiver dois papeis e um deles for `notificador`, este nunca vence —
> mesmo que seja o unico relevante para o fluxo. Divergencia entre banco e frontend.

---

## 2. O que cada papel pode fazer

### Funcoes SQL de autorizacao

| Funcao | Logica |
|---|---|
| `is_admin()` | `papeis_usuarios.papel = 'admin'` |
| `is_supervisor()` | `papel IN ('supervisor', 'moderador')` |
| `is_operador()` | `papel = 'operador'` |
| `usuario_pode_acessar_cliente(id)` | `usuario.cliente_id = id` OU `is_admin()` |
| `supervisor_pode_gerir_usuario(auth_id)` | `is_supervisor()` + mesmo cliente |
| `operador_pode_gerir_usuario(auth_id)` | `is_operador()` + mesmo cliente |
| `papel_permitido_para_supervisor(papel)` | `IN (supervisor, moderador, operador, notificador, usuario)` |
| `papel_permitido_para_operador(papel)` | `IN (operador, usuario)` |

### Matriz de permissoes por papel

| Acao | admin | supervisor | operador | notificador | usuario |
|---|---|---|---|---|---|
| Ver/editar clientes (prefeituras) | OK | NEGADO banco | NEGADO | NEGADO | NEGADO |
| Ver dados do proprio cliente | OK (todos) | OK | OK | OK | OK |
| Criar planejamentos/regioes/ciclos | OK | OK | NEGADO UI | NEGADO | NEGADO |
| Ver levantamentos e focos | OK | OK | OK (limitado) | NEGADO UI | NEGADO |
| Executar vistoria de campo | NEGADO UI | NEGADO UI | OK | NEGADO | NEGADO |
| Registrar casos notificados | OK | OK | NEGADO UI | OK | NEGADO |
| Gerenciar usuarios (criar/editar) | OK (todos) | OK (mesmo cliente) | OK banco / NEGADO UI | NEGADO | NEGADO |
| Atribuir papel admin | OK | NEGADO banco | NEGADO banco | NEGADO | NEGADO |
| Atribuir papel supervisor | OK | OK banco | NEGADO banco | NEGADO | NEGADO |
| Atribuir papel operador/usuario | OK | OK | OK banco / NEGADO UI | NEGADO | NEGADO |
| Ver quotas/drones/voos (plataforma) | OK | OK via URL / NEGADO menu | NEGADO | NEGADO | NEGADO |
| Configurar risk policy | OK | NEGADO menu / OK via URL | NEGADO | NEGADO | NEGADO |
| Ver saude do sistema / job queue | OK | NEGADO menu / OK via URL | NEGADO | NEGADO | NEGADO |

---

## 3. Guards do frontend

| Guard | Arquivo | Condicao de acesso | Fallback |
|---|---|---|---|
| `ProtectedRoute` | `App.tsx` | Sessao valida + senha nao expirada | `/login` |
| `AdminGuard` | `src/pages/Admin.tsx` | `isAdminOrSupervisor` | `/` |
| `AdminOrSupervisorGuard` | `src/guards/` | `isAdminOrSupervisor` | `/` |
| `OperadorGuard` | `src/pages/OperadorGuard.tsx` | `isOperador` (APENAS operador) | `/dashboard` |
| `NotificadorGuard` | `src/guards/` | `papel==='notificador'` OU `isAdminOrSupervisor` | `/dashboard` |

> ATENCAO: `OperadorGuard` bloqueia admin e supervisor de acessar `/agente/*` e `/operador/*`.
> Isso impede suporte e debug de simular o fluxo do agente de campo.

---

## 4. Rotas por papel

### admin — home: `/admin/clientes`

```
/dashboard
/levantamentos
/admin/clientes              (adminOnly no menu)
/admin/painel-municipios     (adminOnly no menu)
/admin/quotas                (adminOnly no menu)
/admin/drones                (adminOnly no menu)
/admin/voos                  (adminOnly no menu)
/admin/yolo-qualidade        (adminOnly no menu)
/admin/pipeline-status       (adminOnly no menu)
/admin/saude-sistema         (adminOnly no menu)
/admin/job-queue             (adminOnly no menu)
/admin/risk-policy           (adminOnly no menu)
/admin/planejamentos, /admin/ciclos, /admin/distribuicao-quarteirao
/admin/operacoes, /admin/historico-atendimento
/admin/casos, /admin/liraa, /admin/score-surto, /admin/reincidencia
/admin/canal-cidadao, /admin/integracoes
/admin/mapa-comparativo, /admin/heatmap-temporal
/admin/produtividade-agentes, /admin/eficacia-tratamentos
/admin/executivo, /admin/supervisor-tempo-real
/admin/pluvio-risco, /admin/pluvio-operacional
/admin/regioes, /admin/usuarios, /admin/unidades-saude
/admin/imoveis, /admin/importar-imoveis, /admin/imoveis-problematicos
/admin/sla, /admin/sla-feriados, /admin/plano-acao, /admin/score-config
/gestor/central, /gestor/triagem, /gestor/focos, /gestor/focos/:id, /gestor/mapa
/notificador, /notificador/registrar, /notificador/consultar
```

### supervisor — home: `/gestor/central`

```
[Mesmo acesso de ROTA que admin — mesma guard: AdminGuard = isAdminOrSupervisor]

Diferenca apenas no MENU:
- Itens adminOnly=true ficam ocultos no sidebar
- Mas as URLs sao acessiveis via navegacao direta (ver secao 6, item C1)
```

### operador/agente — home: `/agente/hoje`

```
/agente/hoje
/agente/vistoria/:imovelId
/agente/imoveis/:id
/operador/imoveis
/operador/levantamentos
/operador/levantamentos/novo-item
/operador/mapa
/operador/rota              (ATENCAO: esta na rota mas NAO em OPERADOR_ALLOWED_PATHS)
/dashboard                  -> redireciona para /agente/hoje

BLOQUEADO:
/operador/usuarios          <- protegido por AdminOrSupervisorGuard
/admin/*
/gestor/*
/notificador/*
```

### notificador — home: `/notificador/registrar`

```
/notificador
/notificador/registrar
/notificador/consultar
/dashboard                  -> sem redirecionamento especial (dashboard generico)

BLOQUEADO:
/admin/*  /operador/*  /agente/*
```

### usuario — sem home definida

```
/dashboard                  -> dashboard generico sem conteudo configurado
Sem rotas proprias
```

---

## 5. Fluxos principais por papel

### Admin (Plataforma SaaS)
- Gerencia prefeituras (clientes) — unico papel que cria/edita clientes no banco
- Gerencia quotas de uso, drones, voos
- Acessa todos os clientes simultaneamente via seletor no header
- Monitora saude do sistema, fila de jobs, pipeline drone
- Pode atribuir qualquer papel a qualquer usuario
- Home: `/admin/clientes`

### Supervisor (Gestao Municipal)
- Admin da prefeitura — acesso total ao modulo operacional
- Cria e gerencia planejamentos, regioes, ciclos, quarteiraos
- Acompanha focos de risco, triagem, mapa, central operacional
- Gerencia usuarios da prefeitura (exceto atribuir papel admin)
- Acessa analises: LIRAa, score de surto, produtividade, eficacia
- Configura SLA, planos de acao, integracoes e-SUS
- Home: `/gestor/central`

### Operador/Agente (Campo)
- Portal proprio — isolado do modulo de gestao
- Visualiza lista de imoveis e realiza vistorias (stepper 5 etapas)
- Registra depositos, sintomas, riscos, sem acesso
- Acessa mapa de rota otimizada
- Ve levantamentos atribuidos
- Home: `/agente/hoje`

### Notificador (UBS/Hospital)
- Registra casos suspeitos/confirmados de dengue, chikungunya, zika
- Consulta protocolos emitidos
- Visualiza historico dos proprios casos
- Home: `/notificador/registrar`

### Usuario (Generico)
- Sem fluxo definido — fica no dashboard padrao sem conteudo
- Nao deve ser atribuido em producao sem papel complementar

---

## 6. Inconsistencias identificadas

### CRITICO — Risco de seguranca ou comportamento errado

#### C1: Supervisor acessa rotas adminOnly via URL direta
- **Problema**: `AdminGuard` = `isAdminOrSupervisor`. Todas as sub-rotas de `/admin/*`
  sao acessiveis para supervisor, incluindo `/admin/clientes`, `/admin/quotas`,
  `/admin/drones`, `/admin/job-queue`, `/admin/saude-sistema`.
- **Mitigacao parcial**: RLS do banco bloqueia acesso a dados de outros clientes.
  Operacoes de escrita (criar cliente, ajustar quota) falham com `is_admin()`.
- **Risco real**: Supervisor pode VER informacoes de plataforma que nao deveria:
  job queue, saude do sistema, lista de slugs de outros clientes.
- **Correcao**: Criar `AdminOnlyGuard` e aplicar nas rotas com `adminOnly=true`.

#### C2: `notificador` ausente do CASE ordering em `get_meu_papel()`
- **Problema**: Funcao SQL tem `ELSE 0` para notificador. Se usuario tiver dois papeis
  e um deles for `notificador`, este perde para qualquer outro.
- **Impacto concreto**: Usuario com `notificador + usuario` retorna `usuario` pelo banco
  (0 < 1), mas `notificador` pelo frontend (priority 2 > 1). Comportamento divergente.
- **Correcao**: Adicionar `WHEN 'notificador' THEN 2` no CASE da funcao SQL.

### ATENCAO — Inconsistencia comportamental

#### A1: Operador pode gerenciar usuarios no banco, mas nao na UI
- **Banco** (migrations `20250306000000` e `20260326143000`): `is_operador()` permite
  INSERT/UPDATE em `usuarios` e `papeis_usuarios` (papeis: operador/usuario) do mesmo cliente.
- **Frontend**: `/operador/usuarios` protegido por `AdminOrSupervisorGuard` — operador bloqueado.
- **Risco**: Via chamada direta a API Supabase, operador pode criar/editar usuarios.
- **Recomendacao**: Decidir o design. Se operador nao deve gerenciar: revogar da RLS.
  Se deve: criar rota no portal agente.

#### A2: `/operador/rota` fora de `OPERADOR_ALLOWED_PATHS`
- **Problema**: `App.tsx:195` registra a rota com `OperadorGuard`, mas
  `OPERADOR_ALLOWED_PATHS` em `AppLayout.tsx` nao inclui `/operador/rota`.
- **Efeito**: Operador que acessar `/operador/rota` e redirecionado pelo AppLayout.
- **Correcao**: Adicionar `/operador/rota` ao array `OPERADOR_ALLOWED_PATHS`.

#### A3: Admin e supervisor nao conseguem acessar o portal do agente
- `OperadorGuard` permite apenas `isOperador`. Admin/supervisor sao redirecionados
  de `/agente/*` e `/operador/*`.
- **Impacto**: Impossivel fazer suporte ou demonstracao do fluxo do agente sem conta operador.
- **Recomendacao**: Permitir `isAdminOrSupervisor` nos guardas do portal agente
  com flag de modo visualizacao, ou criar conta de teste dedicada.

#### A4: `usuario` sem fluxo definido
- Papel `usuario` nao tem home especifica, nao tem menu, nao tem rotas proprias.
- Usuario com este papel fica no dashboard generico sem funcionalidade.
- **Recomendacao**: Documentar que `usuario` nao deve ser atribuido em producao,
  ou criar tela de "acesso nao configurado".

#### A5: `isNotificador` ausente do `AuthContext`
- `AuthContextType` expoe `isAdmin`, `isSupervisor`, `isOperador`, `isAdminOrSupervisor`
  mas NAO `isNotificador`.
- `NotificadorGuard` faz verificacao inline: `papel === 'notificador'`.
- **Risco**: Inconsistencia futura em componentes que precisem checar o papel.
- **Correcao**: Adicionar `isNotificador` ao contexto e ao Provider.

#### A6: Tabela `drones` com SELECT sem isolamento por cliente
- Migration `20250302100000`: `drones_select` usa `USING (true)` — qualquer autenticado
  ve todos os drones de todas as prefeituras.
- **Risco baixo** (dados nao criticos), mas vaza informacoes de frota entre clientes.

#### A7: Supervisor pode promover outros a supervisor
- `papel_permitido_para_supervisor` inclui `supervisor` na lista permitida.
- Um supervisor pode escalar qualquer usuario do proprio cliente para supervisor,
  incluindo a si mesmo, sem auditoria especifica.
- **Recomendacao**: Avaliar se isso e intencional ou deve exigir aprovacao do admin.

---

## 7. Confusao de nomenclatura

| Termo no codigo | Significado real | Problema |
|---|---|---|
| `Admin` (frontend) | Plataforma SaaS (suporte tecnico) | Claro |
| `Supervisor` (frontend) | Admin da prefeitura | Claro |
| `Moderador` (banco) | Alias de supervisor | Nunca usado na UI; candidato a remocao |
| `Operador` (frontend/rotas) | Agente de Campo | Portal chama-se `/operador/*` mas menu diz "Agente de Endemias" |
| `Agente` (rotas) | Mesmo que operador | Rotas `/agente/*` e `/operador/*` coexistem como legado |
| `Cliente` (banco) | Alias de usuario | Papel legado; nao usado na UI |
| `Platform_admin` (banco) | Dead value | Permanece no enum mas neutralizado |
| `isAdminOrSupervisor` | Admin OU supervisor | Nome claro, mas guard e abrangente demais para rotas de plataforma |

---

## 8. Analise de seguranca multitenancy

### Status geral: SOLIDO com ressalvas

**Bem implementado:**
- Funcao `usuario_pode_acessar_cliente()` e SECURITY DEFINER e usada de forma consistente
- Todas as tabelas criticas tem RLS habilitado
- `is_admin()` separado do isolamento por cliente (correto)
- Triggers criticos (cruzamento caso-foco, score, SLA) sao SECURITY DEFINER
- Soft delete protegido por `trg_bloquear_hard_delete`
- `denunciar_cidadao` tem rate limit e deduplicacao PostGIS

**Ressalvas:**
- `drones`: SELECT sem isolamento por cliente (A6)
- Supervisor acessa rotas de plataforma via URL direta (C1)
- `get_meu_papel` com bug de prioridade para notificador (C2)

---

## 9. O que deve ser corrigido ANTES da implantacao

### Obrigatorio

| # | Problema | Correcao |
|---|---|---|
| 1 | `notificador` ausente do CASE em `get_meu_papel()` | Adicionar `WHEN 'notificador' THEN 2` na funcao SQL |
| 2 | `/operador/rota` fora de `OPERADOR_ALLOWED_PATHS` | Adicionar ao array em `AppLayout.tsx` |
| 3 | Supervisor acessa rotas de plataforma via URL | Criar `AdminOnlyGuard` para rotas `adminOnly=true` em `/admin/*` |

### Recomendado (antes de escalar)

| # | Problema | Correcao |
|---|---|---|
| 4 | Operador pode gerenciar usuarios via API direta | Revogar da RLS OU criar UI no portal agente |
| 5 | `isNotificador` ausente do AuthContext | Adicionar ao `AuthContextType` e ao Provider |
| 6 | Admin/supervisor nao acessam portal do agente | Permitir `isAdminOrSupervisor` no OperadorGuard com flag de visualizacao |
| 7 | `usuario` sem fluxo definido | Documentar ou criar tela de "acesso nao configurado" |
| 8 | `moderador` e `cliente` nunca usados na UI | Avaliar remocao do enum ou manter documentado |
| 9 | Supervisor pode promover outros a supervisor | Restringir `papel_permitido_para_supervisor` se necessario |
| 10 | `drones` sem isolamento por cliente | Avaliar adicionar `cliente_id` ou manter como recurso de plataforma documentado |

### Housekeeping (sem urgencia)

| # | Problema |
|---|---|
| 11 | `platform_admin` permanece no enum PostgreSQL como dead value |
| 12 | Nomenclatura operador vs agente inconsistente — rotas `/operador/*` e `/agente/*` coexistem |
| 13 | `/operador/inicio` redireciona para `/agente/hoje` — legado nunca removido |

---

## 10. Fluxo de autenticacao (resumo)

```
Login
  -> get_meu_papel() [banco, SECURITY DEFINER, fonte da verdade]
       -> normalizePapel() [frontend: mapeia platform_admin/moderador/cliente]
            -> admin       : home /admin/clientes
            -> supervisor  : home /gestor/central
            -> operador    : home /agente/hoje
            -> notificador : home /notificador/registrar
            -> usuario     : home /dashboard (sem conteudo especifico)

Acesso a qualquer rota protegida:
  -> ProtectedRoute (sessao valida?)
       -> Guard especifico (AdminGuard / OperadorGuard / NotificadorGuard)
            -> Componente renderizado
                 -> api.* -> Supabase RLS (segunda linha de defesa)
                      -> usuario_pode_acessar_cliente() -> dados filtrados por cliente_id
```
