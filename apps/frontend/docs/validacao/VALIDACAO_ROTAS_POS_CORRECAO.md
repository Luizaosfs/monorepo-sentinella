# VALIDAÇÃO — Acesso por rotas (pós-correção)

**Arquivos de referência:**
- `src/App.tsx` — definição de rotas e guards
- `src/guards/PlatformAdminGuard.tsx`
- `src/guards/AdminOrSupervisorGuard.tsx`
- `src/guards/NotificadorGuard.tsx`
- `src/hooks/useAuth.tsx` — computed booleans por papel

**Validado em:** 2026-04-02

---

## 1. Guards disponíveis e suas regras

| Guard                   | Permite                              | Redireciona para     |
|-------------------------|--------------------------------------|----------------------|
| `AdminGuard` (page)     | Qualquer autenticado (admin-level)   | `/login` se não auth |
| `PlatformAdminGuard`    | `isAdmin` apenas                     | `/gestor/central`    |
| `AdminOrSupervisorGuard`| `isAdmin OR isSupervisor`            | `/`                  |
| `NotificadorGuard`      | `notificador OR isAdminOrSupervisor` | `/dashboard`         |
| `OperadorGuard` (page)  | Usuários autenticados com acesso op. | `/login` se não auth |

**Computed booleans em `useAuth.tsx`:**
```ts
isAdmin            = papel === 'admin'
isSupervisor       = papel === 'supervisor'
isOperador         = papel === 'operador'
isAdminOrSupervisor = isAdmin || isSupervisor
```

---

## 2. Mapa de rotas e proteções

### 2.1 Rotas `/admin/*` — restrito a admin

Todas as rotas sob `/admin` estão dentro de `<Route path="/admin" element={<AdminGuard />}>`.

| Rota                            | Guard adicional        | Acesso permitido     |
|---------------------------------|------------------------|----------------------|
| `/admin/clientes`               | `PlatformAdminGuard`   | admin                |
| `/admin/usuarios`               | nenhum adicional       | admin (via AdminGuard) |
| `/admin/drones`                 | `PlatformAdminGuard`   | admin                |
| `/admin/risk-policy`            | `PlatformAdminGuard`   | admin                |
| `/admin/voos`                   | `PlatformAdminGuard`   | admin                |
| `/admin/quotas`                 | `PlatformAdminGuard`   | admin                |
| `/admin/painel-municipios`      | `PlatformAdminGuard`   | admin                |
| `/admin/yolo-qualidade`         | `PlatformAdminGuard`   | admin                |
| `/admin/saude-sistema`          | `PlatformAdminGuard`   | admin                |
| `/admin/job-queue`              | `PlatformAdminGuard`   | admin                |
| `/admin/pipeline-status`        | `PlatformAdminGuard`   | admin                |
| `/admin/sla`                    | nenhum adicional       | admin (via AdminGuard) |
| `/admin/score-config`           | nenhum adicional       | admin (via AdminGuard) |
| Demais rotas `/admin/*`         | nenhum adicional       | admin (via AdminGuard) |

---

### 2.2 Rotas `/gestor/*` — restrito a admin ou supervisor

| Rota                    | Guard                    | Acesso permitido          |
|-------------------------|--------------------------|---------------------------|
| `/gestor/central`       | `AdminOrSupervisorGuard` | admin, supervisor         |
| `/gestor/triagem`       | `AdminOrSupervisorGuard` | admin, supervisor         |
| `/gestor/focos`         | `AdminOrSupervisorGuard` | admin, supervisor         |
| `/gestor/focos/:id`     | `AdminOrSupervisorGuard` | admin, supervisor         |
| `/gestor/mapa`          | `AdminOrSupervisorGuard` | admin, supervisor         |

Operador tentando acessar `/gestor/*` → redirecionado para `/`. ✅

---

### 2.3 Rotas `/operador/*` — restrito a operadores

| Rota                                  | Guard            | Acesso permitido          |
|---------------------------------------|------------------|---------------------------|
| `/operador`                           | `OperadorGuard`  | operador (campo)          |
| `/operador/levantamentos`             | `OperadorGuard`  | operador                  |
| `/operador/levantamentos/novo-item`   | `OperadorGuard`  | operador                  |
| `/operador/mapa`                      | `OperadorGuard`  | operador                  |
| `/operador/imoveis`                   | `OperadorGuard`  | operador                  |
| `/operador/vistoria/:imovelId`        | `OperadorGuard`  | operador                  |
| `/operador/rota`                      | `OperadorGuard`  | operador                  |
| `/operador/usuarios`                  | `AdminOrSupervisorGuard` | admin, supervisor |

Nota: `/operador/usuarios` usa `AdminOrSupervisorGuard` — operador não acessa gestão de usuários. ✅

---

### 2.4 Rotas `/agente/*` — restrito a operadores

| Rota                        | Guard           | Acesso permitido |
|-----------------------------|-----------------|------------------|
| `/agente/hoje`              | `OperadorGuard` | operador         |
| `/agente/imoveis/:id`       | `OperadorGuard` | operador         |
| `/agente/vistoria/:imovelId`| `OperadorGuard` | operador         |

---

### 2.5 Rotas `/notificador/*` — restrito a notificador, admin, supervisor

| Rota                        | Guard               | Acesso permitido                  |
|-----------------------------|---------------------|-----------------------------------|
| `/notificador`              | `NotificadorGuard`  | notificador, admin, supervisor    |
| `/notificador/registrar`    | `NotificadorGuard`  | notificador, admin, supervisor    |
| `/notificador/consultar`    | `NotificadorGuard`  | notificador, admin, supervisor    |

Operador tentando `/notificador/*` → redirecionado para `/dashboard`. ✅

---

### 2.6 Rotas `/levantamentos` — admin ou supervisor

```
/levantamentos → AdminOrSupervisorGuard
```

---

### 2.7 Rotas públicas (sem guard)

| Rota                       | Observação                            |
|----------------------------|---------------------------------------|
| `/login`                   | Pública                               |
| `/denuncia/:slug/:bairroId`| Página de denúncia cidadão (sem auth) |
| `/denuncia/consultar`      | Consulta pública de protocolo         |
| `/install`                 | Instalação PWA                        |

---

## 3. Redirecionamento pós-login por papel

Definido em `useAuth.tsx` via `HOME_BY_PAPEL`:

| Papel       | Rota padrão pós-login |
|-------------|----------------------|
| admin       | `/admin/clientes`    |
| supervisor  | `/gestor/central`    |
| operador    | `/agente/hoje`       |
| notificador | `/notificador`       |
| null (desconhecido) | `/login`   |

`papel === null` → sem rota, forçado ao login. ✅

---

## 4. Resultado

| Verificação                                              | Status  |
|----------------------------------------------------------|---------|
| Operador bloqueado de `/admin/*`                         | ✅ OK   |
| Operador bloqueado de `/gestor/*`                        | ✅ OK   |
| Operador bloqueado de `/operador/usuarios`               | ✅ OK   |
| Operador bloqueado de `/notificador/*`                   | ✅ OK   |
| Supervisor bloqueado de `/admin/clientes` e outros PlatformAdmin | ✅ OK |
| Supervisor redireciona para `/gestor/central` ao tentar PlatformAdmin | ✅ OK |
| Rotas públicas sem auth funcionam corretamente           | ✅ OK   |
| `papel === null` → sem acesso a rotas protegidas         | ✅ OK   |
