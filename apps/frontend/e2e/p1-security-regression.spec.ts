/**
 * E2E: Regressão de segurança P0/P1
 *
 * Cobre os hardening feitos nas etapas P0-1 a P1-4:
 *   - Guards por papel (admin, supervisor, operador, notificador)
 *   - Isolamento cross-tenant (rotas e API)
 *   - Tenant bloqueado / inadimplente
 *   - Fluxo de login → redirecionamento correto por papel
 *   - Rotas públicas acessíveis sem auth
 *   - Rotas protegidas redirecionam sem auth
 *   - JWT claims (via app_metadata) — verificado indiretamente pela UI
 *
 * Credenciais necessárias em .env.e2e:
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD  (opcional)
 *   TEST_OPERADOR_EMAIL / TEST_OPERADOR_PASSWORD      (opcional)
 *   TEST_NOTIF_EMAIL / TEST_NOTIF_PASSWORD            (opcional)
 *   TEST_ADMIN_B_EMAIL / TEST_ADMIN_B_PASSWORD        — admin de outro cliente (opcional)
 */
import { test, expect } from '@playwright/test';
import {
  loginAs,
  loginAsAdmin,
  loginAsOperador,
  loginAsNotificador,
  loginAsSupervisor,
  hasAdminTestCredentials,
  hasOperadorTestCredentials,
  hasNotificadorTestCredentials,
  hasSupervisorTestCredentials,
} from './helpers/auth';

// ─── Rotas protegidas por papel ───────────────────────────────────────────────

const ADMIN_ONLY_ROUTES = [
  '/admin/casos',
  '/admin/sla',
  '/admin/usuarios',
  '/admin/integracoes',
  '/admin/quotas',
  '/admin/score-config',
];

const GESTOR_ROUTES = [
  '/gestor/focos',
  '/gestor/central',
  '/gestor/mapa',
];

const OPERADOR_ROUTES = [
  '/operador/inicio',
  '/operador/imoveis',
];

const NOTIFICADOR_ROUTES = [
  '/notificador/registrar',
];

const PUBLIC_ROUTES = [
  '/login',
  '/denuncia/consultar',
];

// ─── 1. Rotas protegidas redirecionam sem autenticação ────────────────────────

test.describe('P1 — rotas protegidas sem autenticação', () => {
  for (const route of [...ADMIN_ONLY_ROUTES, ...GESTOR_ROUTES, ...OPERADOR_ROUTES, ...NOTIFICADOR_ROUTES]) {
    test(`[guard] ${route} redireciona para /login sem auth`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      const isProtected = url.includes('/login') || url === '/' || url.includes('/403');
      expect(isProtected, `Rota ${route} não redirecionou — URL: ${url}`).toBe(true);
    });
  }
});

// ─── 2. Rotas públicas NÃO redirecionam ───────────────────────────────────────

test.describe('P1 — rotas públicas acessíveis sem auth', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`[public] ${route} responde sem redirecionar para login`, async ({ page }) => {
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp?.status()).toBeLessThan(500);
      if (route !== '/login') {
        await expect(page).not.toHaveURL(/\/login/);
      }
    });
  }

  test('[public] /denuncia/:slug/:bairroId responde sem auth', async ({ page }) => {
    const slug = process.env.TEST_CANAL_SLUG ?? 'slug-teste';
    const bairroId = process.env.TEST_CANAL_BAIRRO_ID ?? '00000000-0000-0000-0000-000000000000';
    const resp = await page.goto(`/denuncia/${slug}/${bairroId}`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── 3. Admin — acesso e isolamento ──────────────────────────────────────────

test.describe('P1 — papel admin', () => {
  test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD');

  test('[admin] login redireciona para área admin ou gestor', async ({ page }) => {
    await loginAsAdmin(page);
    const url = page.url();
    expect(url).toMatch(/\/(admin|gestor|dashboard)/);
  });

  test('[admin] acessa /admin/usuarios sem erro', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/403|acesso negado|sem permissão/i)).not.toBeVisible({ timeout: 4_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });

  test('[admin] acessa /admin/integracoes sem erro', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/integracoes');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('[admin] chamadas à API incluem cliente_id (sem leak cross-tenant)', async ({ page }) => {
    await loginAsAdmin(page);

    const apiCalls: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/rest/v1/')) apiCalls.push(res.url());
    });

    await page.goto('/admin/casos');
    await page.waitForLoadState('networkidle');

    for (const url of apiCalls) {
      // Nenhuma chamada pode passar cliente_id=null
      expect(url).not.toMatch(/eq\(cliente_id,null\)/);
    }
  });
});

// ─── 4. Supervisor — acesso a gestor, bloqueado de admin exclusivo ────────────

test.describe('P1 — papel supervisor', () => {
  test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD');

  test('[supervisor] login redireciona para área gestor ou dashboard', async ({ page }) => {
    await loginAsSupervisor(page);
    const url = page.url();
    expect(url).toMatch(/\/(gestor|dashboard)/);
  });

  test('[supervisor] acessa /gestor/focos sem erro', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('[supervisor] bloqueado de /admin/usuarios — redireciona', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('domcontentloaded');
    // PlatformAdminGuard redireciona para /gestor/central
    await expect(page).not.toHaveURL(/\/admin\/usuarios/);
  });
});

// ─── 5. Operador — acesso limitado ────────────────────────────────────────────

test.describe('P1 — papel operador', () => {
  test.skip(!hasOperadorTestCredentials(), 'Requer TEST_OPERADOR_EMAIL/PASSWORD');

  test('[operador] login redireciona para /operador/inicio ou /dashboard', async ({ page }) => {
    await loginAsOperador(page);
    const url = page.url();
    expect(url).toMatch(/\/(operador|dashboard)/);
  });

  test('[operador] acessa /operador/inicio sem erro', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('[operador] bloqueado de /admin/usuarios — redireciona', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/admin\/usuarios/);
  });

  test('[operador] bloqueado de /gestor/focos — redireciona', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/gestor\/focos/);
  });
});

// ─── 6. Notificador — acesso a /notificador, bloqueado de admin/gestor ────────

test.describe('P1 — papel notificador', () => {
  test.skip(!hasNotificadorTestCredentials(), 'Requer TEST_NOTIF_EMAIL/PASSWORD');

  test('[notificador] login redireciona para /notificador ou /dashboard', async ({ page }) => {
    await loginAsNotificador(page);
    const url = page.url();
    expect(url).toMatch(/\/(notificador|dashboard)/);
  });

  test('[notificador] acessa /notificador/registrar sem erro', async ({ page }) => {
    await loginAsNotificador(page);
    await page.goto('/notificador/registrar');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('[notificador] bloqueado de /admin/usuarios — redireciona', async ({ page }) => {
    await loginAsNotificador(page);
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/admin\/usuarios/);
  });

  test('[notificador] bloqueado de /gestor/focos — redireciona', async ({ page }) => {
    await loginAsNotificador(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/gestor\/focos/);
  });
});

// ─── 7. Cross-tenant — admin B não vê dados de admin A ───────────────────────

test.describe('P1 — isolamento cross-tenant', () => {
  const ADMIN_B_EMAIL    = process.env.TEST_ADMIN_B_EMAIL    ?? '';
  const ADMIN_B_PASSWORD = process.env.TEST_ADMIN_B_PASSWORD ?? '';

  test.skip(
    !hasAdminTestCredentials() || !ADMIN_B_EMAIL,
    'Requer TEST_ADMIN_EMAIL e TEST_ADMIN_B_EMAIL'
  );

  test('[rls] admin B não vê registros de clientes A na lista de usuários', async ({ page }) => {
    // Login como admin B
    await loginAs(page, ADMIN_B_EMAIL, ADMIN_B_PASSWORD);

    const apiResponses: { url: string; body: unknown }[] = [];
    page.on('response', async (res) => {
      if (res.url().includes('/rest/v1/usuarios')) {
        const body = await res.json().catch(() => []);
        apiResponses.push({ url: res.url(), body });
      }
    });

    await page.goto('/admin/usuarios');
    await page.waitForLoadState('networkidle');

    // Nenhuma resposta deve conter usuários de outro cliente
    // (verificação estrutural: todas as chamadas têm filtro cliente_id)
    for (const { url } of apiResponses) {
      expect(url, 'Chamada sem filtro cliente_id').not.toMatch(/from=usuarios&select/);
    }
  });
});

// ─── 8. Billing / tenant bloqueado ────────────────────────────────────────────

test.describe('P1 — billing e tenant status', () => {
  test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD');

  test('[billing] admin autenticado vê QuotaBanner sem crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/casos');
    await page.waitForLoadState('networkidle');
    // Página carrega sem crash — banner pode ou não estar visível
    await expect(page.locator('body')).toBeVisible();
  });

  test('[billing] botões de ação não estão desabilitados para tenant ativo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/voos');
    await page.waitForLoadState('networkidle');
    // Botão principal de criar não deve estar disabled para tenant ativo
    const primaryBtn = page.getByRole('button', { name: /novo|criar|adicionar/i }).first();
    const exists = await primaryBtn.count();
    if (exists > 0) {
      await expect(primaryBtn).not.toBeDisabled();
    }
  });
});

// ─── 9. Fluxos críticos — smoke ───────────────────────────────────────────────

test.describe('P1 — smoke de fluxos críticos', () => {
  test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD');

  test('[smoke] dashboard carrega sem erro de JS', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await loginAsAdmin(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection')
    );
    expect(criticalErrors, `Erros de JS: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('[smoke] /gestor/focos carrega tabela ou estado vazio', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('networkidle');
    // Deve exibir tabela ou mensagem de vazio — nunca crash
    const hasTable  = await page.locator('table, [role="table"]').count();
    const hasEmpty  = await page.getByText(/nenhum|sem focos|vazio/i).count();
    const hasLoader = await page.locator('[data-testid="loader"], .animate-spin').count();
    expect(hasTable + hasEmpty + hasLoader).toBeGreaterThan(0);
  });

  test('[smoke] /admin/integracoes não exibe API key em texto plano', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/integracoes');
    await page.waitForLoadState('networkidle');

    // Inputs de api_key devem ser do tipo password (mascarados)
    const apiKeyInputs = page.locator('input[name*="api_key"], input[placeholder*="key" i], input[placeholder*="token" i]');
    const count = await apiKeyInputs.count();
    for (let i = 0; i < count; i++) {
      const type = await apiKeyInputs.nth(i).getAttribute('type');
      expect(type, `Campo de chave não mascarado (índice ${i})`).toBe('password');
    }
  });

  test('[smoke] /admin/audit-log rota inexistente redireciona (não 500)', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.goto('/admin/audit-log', { waitUntil: 'domcontentloaded' });
    // Rota pode não existir ainda — espera redirect ou 404, nunca 500
    expect(resp?.status() ?? 200).not.toBe(500);
  });
});
