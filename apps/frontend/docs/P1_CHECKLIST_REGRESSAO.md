# P1 — Checklist de Não Regressão

> Roteiro de validação manual após o hardening P0/P1 (2026-04).
> Execute **após cada deploy** que toque auth, RLS, billing ou guards.

---

## 1. Checklist por Papel

### 1.1 Admin

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| A1 | Login com conta admin | Redireciona para `/admin/...` ou `/gestor/central` | ☐ |
| A2 | Abre `/admin/usuarios` | Tabela carrega, sem erro 403 | ☐ |
| A3 | Abre `/admin/integracoes` | Campo API key mascarado (`type=password`) | ☐ |
| A4 | Abre `/admin/quotas` | Barras de uso visíveis, sem crash | ☐ |
| A5 | Cria um voo em `/admin/voos` | Botão "Novo" habilitado (tenant ativo) | ☐ |
| A6 | Abre `/gestor/focos` | Tabela de focos carrega | ☐ |
| A7 | Abre `/gestor/central` | KPIs do dia visíveis | ☐ |
| A8 | Troca papel de um usuário para `supervisor` | Papel atualizado, sem erro | ☐ |
| A9 | Consulta `/admin/sla` | Timeline de SLA visível | ☐ |

### 1.2 Supervisor

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| S1 | Login com conta supervisor | Redireciona para `/gestor/...` ou `/dashboard` | ☐ |
| S2 | Acessa `/gestor/focos` | Carrega sem erro | ☐ |
| S3 | Tenta acessar `/admin/usuarios` | **Redireciona** para `/gestor/central` (PlatformAdminGuard) | ☐ |
| S4 | Tenta acessar `/admin/clientes` | **Redireciona** — não admin-only | ☐ |
| S5 | Vê mapa em `/gestor/mapa` | Mapa carrega com focos do próprio tenant | ☐ |

### 1.3 Operador

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| O1 | Login com conta operador | Redireciona para `/operador/inicio` ou `/dashboard` | ☐ |
| O2 | Acessa `/operador/inicio` | Dashboard do turno visível | ☐ |
| O3 | Acessa `/operador/imoveis` | Lista de imóveis carrega | ☐ |
| O4 | Tenta acessar `/gestor/focos` | **Redireciona** (AdminOrSupervisorGuard) | ☐ |
| O5 | Tenta acessar `/admin/usuarios` | **Redireciona** | ☐ |
| O6 | Tenta acessar `/notificador/registrar` | **Redireciona** (NotificadorGuard) | ☐ |
| O7 | Inicia vistoria em imóvel | Stepper 5 etapas funcional | ☐ |

### 1.4 Notificador

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| N1 | Login com conta notificador | Redireciona para `/notificador/...` ou `/dashboard` | ☐ |
| N2 | Acessa `/notificador/registrar` | Formulário de caso visível | ☐ |
| N3 | Registra caso (dengue suspeito) | Caso criado, mensagem de sucesso | ☐ |
| N4 | Tenta acessar `/gestor/focos` | **Redireciona** | ☐ |
| N5 | Tenta acessar `/admin/usuarios` | **Redireciona** | ☐ |

---

## 2. Checklist de Tenant / Isolamento

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| T1 | Admin do cliente A faz login | Vê apenas dados do cliente A em todas as listagens | ☐ |
| T2 | Admin do cliente A acessa `/admin/usuarios` | Lista só usuários do cliente A | ☐ |
| T3 | Inspecionar network tab em `/admin/casos` | Toda chamada REST inclui `eq(cliente_id,<uuid>)` | ☐ |
| T4 | Admin B faz login separado | Não vê usuários, focos ou vistorias do cliente A | ☐ |
| T5 | URL direta com ID de recurso de outro cliente | API retorna 0 resultados (RLS bloqueia) | ☐ |
| T6 | Tenant com status `suspenso` | QuotaBanner exibe alerta vermelho não-dismissável | ☐ |
| T7 | Tenant `suspenso`: botão "Novo Voo" | Botão **desabilitado** (isBlocked=true) | ☐ |
| T8 | Tenant `inadimplente`: botão "Criar usuário" | Botão **desabilitado** | ☐ |
| T9 | Tenant `trial` com ≤7 dias: banner amber | Exibe dias restantes, não-dismissável | ☐ |
| T10| Tenant reativado para `ativo` | Botões voltam a funcionar | ☐ |

---

## 3. Checklist de Integrações

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| I1 | Abre `/admin/integracoes` | Campo `api_key` exibe `••••••••` (mascarado) | ☐ |
| I2 | Salva configuração e-SUS Notifica | API key salva, sem exposição no payload visível | ☐ |
| I3 | Clica "Testar conexão" | Resposta OK ou mensagem de erro clara | ☐ |
| I4 | Inspeciona network: chamada `get_integracao_api_key` | Só aparece via RPC com usuário autenticado do tenant | ☐ |
| I5 | Tenta RPC `get_integracao_api_key` com JWT de outro tenant | Retorna null / erro de permissão | ☐ |

---

## 4. Checklist de Billing / Quotas

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| B1 | Uso de vistorias em 70–99% | QuotaBanner laranja dismissável visível | ☐ |
| B2 | Uso de vistorias em 100% | QuotaBanner vermelho não-dismissável visível | ☐ |
| B3 | Cria vistoria quando quota em 100% | Erro amigável, não cria registro | ☐ |
| B4 | `surto_ativo = true` no cliente | Grace de 150%: vistorias passam mesmo acima da quota | ☐ |
| B5 | RPC `fn_get_tenant_context` chamada | Retorna `{status, plano_nome, is_blocked, is_trialing}` | ☐ |
| B6 | `cliente_verificar_quota` com tenant suspenso | Retorna `{ok: false, motivo: 'tenant_bloqueado'}` | ☐ |

---

## 5. Checklist de Fluxos

### 5.1 Login e Auth

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| L1 | Login válido admin | JWT contém `app_metadata.papel = 'admin'` (inspecionar devtools) | ☐ |
| L2 | Login com credencial errada | Mensagem de erro "Email ou senha inválidos" | ☐ |
| L3 | Token expirado / reload | Sessão restaurada sem loop de redirect | ☐ |
| L4 | Logout | Redireciona para `/login`, sem dados em cache | ☐ |
| L5 | Primeiro login (must_change_password=true) | Redireciona para `/trocar-senha` | ☐ |

### 5.2 Mapa

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| M1 | Abre `/gestor/mapa` | Mapa carrega, pins de focos visíveis | ☐ |
| M2 | Filtra por status `confirmado` | Pins filtrados corretamente | ☐ |
| M3 | Filtra por score territorial | Mapa atualiza | ☐ |
| M4 | Clica em pin | Popup com dados do foco abre | ☐ |

### 5.3 Focos de Risco

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| F1 | Abre `/gestor/focos` | KPI bar + tabela visíveis | ☐ |
| F2 | Transiciona foco: `suspeita → em_triagem` | Status atualiza, histórico registrado | ☐ |
| F3 | Transiciona foco: `confirmado → em_tratamento` | SLA começa a contar | ☐ |
| F4 | Tenta estado terminal `resolvido → confirmado` | Bloqueado (state machine) | ☐ |
| F5 | Encaminha foco para agente | Dialog visível, `responsavel_id` preenchido | ☐ |
| F6 | Foco com origem `cidadao` | Badge violeta "Cidadão" visível | ☐ |

### 5.4 Vistoria

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| V1 | Operador inicia vistoria (etapa 1) | GPS checkin + moradores | ☐ |
| V2 | Etapa 3: depósitos com focos | Contador vermelho quando foco > 0 | ☐ |
| V3 | Etapa 5: risco social marcado | Contador de riscos atualiza | ☐ |
| V4 | Etapa 5: clicar "Finalizar vistoria" | Vistoria salva, tela de sucesso | ☐ |
| V5 | Sem acesso ao imóvel | Fluxo `VistoriaSemAcesso` abre, motivo salvo | ☐ |
| V6 | 3ª tentativa sem acesso | Toast especial, `prioridade_drone=true` no imóvel | ☐ |
| V7 | Tenant bloqueado: botão "Finalizar" | **Desabilitado** (isBlocked propagado) | ☐ |

### 5.5 Reinspeção e Timeline

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| R1 | Cria reinspeção para foco `confirmado` | Agendada com data futura | ☐ |
| R2 | Abre timeline de foco | Todos os eventos em ordem cronológica | ☐ |
| R3 | Reagenda reinspeção | Nova data persiste | ☐ |

### 5.6 Dashboards

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| D1 | `/gestor/central` — KPIs do dia | 4 cards visíveis (focos, SLA, score, vistorias) | ☐ |
| D2 | `/admin/score-surto` | Regiões com score visíveis | ☐ |
| D3 | `/admin/liraa` | IIP municipal + tabela por quarteirão | ☐ |
| D4 | `/admin/pipeline-status` | Histórico de runs visível | ☐ |

### 5.7 Offline / Sync

| # | Ação | Resultado esperado | OK? |
|---|------|--------------------|-----|
| X1 | Desconecta rede → finaliza vistoria | `OfflineBanner` exibe "1 pendente" | ☐ |
| X2 | Reconecta rede | `useOfflineQueue` drena, toast de sync | ☐ |
| X3 | Múltiplas vistorias offline | Todas drenadas em ordem (sem duplicação) | ☐ |

---

## 6. Riscos Residuais

| Risco | Severidade | Mitigação | Status |
|-------|-----------|-----------|--------|
| `custom_access_token_hook` pode falhar silenciosamente se a função SQL mudar de assinatura | Alta | Fallback em 3 camadas em `useAuth.tsx` (app_metadata → get_meu_papel RPC → papeis_usuarios direto) | Mitigado |
| `normalizarPapel()` em labels.ts retorna `'operador'` como fallback — pode mascarar papel inválido | Média | `normalizePapel()` em useAuth retorna `null` para papel inválido — dupla camada | Monitorar |
| Tenant `suspenso` pode ter race condition entre `fn_get_tenant_context` e UI render | Baixa | `isBlocked` propagado via `useClienteAtivo` context — avaliado em cada render | Aceito |
| audit_log sem RLS para INSERT direto — atores maliciosos com service_role podem inserir logs falsos | Média | Aceito: service_role é infra interna; `fn_insert_audit_log` usada apenas por triggers SECURITY DEFINER | Aceito |
| Campos `gestor`/`agente` adicionados a labels.ts mas `useAuth` não exporta `isGestor`/`isAgente` flags | Baixa | Guards de rotas gestor usam `isAdminOrSupervisor`; flag `isAgente` não criado ainda | Pendente |

---

## 7. Execução Automatizada

```bash
# Testes unitários (inclui labels, normalizarPapel, transições)
npm run test

# E2E de regressão P1 (requer .env.e2e configurado)
npx playwright test e2e/p1-security-regression.spec.ts

# E2E completo de segurança e multitenancy
npx playwright test e2e/p1-security-regression.spec.ts e2e/multitenancy-rls.spec.ts e2e/seguranca-cross-tenant.spec.ts

# Cobertura
npm run test:coverage
```

### Variáveis mínimas para E2E (`.env.e2e`)

```env
TEST_ADMIN_EMAIL=admin@cliente-a.com.br
TEST_ADMIN_PASSWORD=senha_admin_a
TEST_SUPERVISOR_EMAIL=supervisor@cliente-a.com.br
TEST_SUPERVISOR_PASSWORD=senha_supervisor
TEST_OPERADOR_EMAIL=operador@cliente-a.com.br
TEST_OPERADOR_PASSWORD=senha_operador
TEST_NOTIF_EMAIL=notificador@ubs-a.com.br
TEST_NOTIF_PASSWORD=senha_notif
TEST_ADMIN_B_EMAIL=admin@cliente-b.com.br
TEST_ADMIN_B_PASSWORD=senha_admin_b
```
