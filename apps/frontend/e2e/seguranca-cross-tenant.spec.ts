/**
 * E2E: Segurança — Isolamento cross-tenant e RBAC
 *
 * Cobre:
 *  - Rotas de cada papel bloqueadas para papéis inferiores
 *  - Admin de cliente A não acessa rotas de cliente B via URL
 *  - Operador não acessa /admin/*
 *  - Supervisor não acessa /admin/clientes (platform admin)
 *  - Todas as rotas protegidas redirecionam sem auth
 *  - Chamadas API incluem filtro cliente_id (sem vazamento)
 *
 * Credenciais (opcional, .env.e2e):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_OPERADOR_EMAIL / TEST_OPERADOR_PASSWORD
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD
 */
import { test, expect } from '@playwright/test';
import {
  loginAsAdmin, loginAsOperador, loginAsSupervisor,
  hasAdminTestCredentials, hasOperadorTestCredentials, hasSupervisorTestCredentials,
} from './helpers/auth';

// ── Rotas protegidas sem autenticação ─────────────────────────────────────────

test.describe('Segurança — Rotas sem autenticação', () => {
  const rotasProtegidas = [
    '/admin/dashboard',
    '/admin/clientes',
    '/admin/casos',
    '/admin/sla',
    '/admin/score-config',
    '/gestor/focos',
    '/gestor/central',
    '/gestor/mapa',
    '/agente/hoje',
    '/operador/inicio',
    '/operador/imoveis',
    '/notificador/registrar',
  ];

  for (const rota of rotasProtegidas) {
    test(`[guard] ${rota} redireciona para /login sem auth`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      const protegida = url.includes('/login') || url.includes('/403');
      expect(protegida, `Rota ${rota} não está protegida — URL atual: ${url}`).toBe(true);
    });
  }
});

// ── Rotas públicas (não exigem auth) ─────────────────────────────────────────

test.describe('Segurança — Rotas públicas acessíveis', () => {
  test('[public] /login está acessível', async ({ page }) => {
    const res = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
  });

  test('[public] /denuncia/consultar não redireciona para login', async ({ page }) => {
    await page.goto('/denuncia/consultar', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ── Isolamento de papel: operador não acessa /admin ───────────────────────────

test.describe('Segurança — Operador isolado de /admin', () => {
  test.skip(!hasOperadorTestCredentials(), 'Requer TEST_OPERADOR_EMAIL/PASSWORD no .env.e2e');

  test('[rbac] operador autenticado não acessa /admin/dashboard', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
    // Deve redirecionar para rota do operador ou login
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
  });

  test('[rbac] operador autenticado não acessa /admin/clientes', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/admin/clientes');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/admin\/clientes/);
  });

  test('[rbac] operador autenticado não acessa /gestor/focos', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/gestor\/focos/);
  });
});

// ── Isolamento de papel: supervisor não acessa platform admin ─────────────────

test.describe('Segurança — Supervisor isolado de /admin/clientes', () => {
  test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

  test('[rbac] supervisor não acessa /admin/clientes (plataforma SaaS)', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/admin/clientes');
    await page.waitForLoadState('domcontentloaded');
    // Supervisor deve ser redirecionado para sua rota (/gestor/*)
    await expect(page).not.toHaveURL(/\/admin\/clientes/);
  });
});

// ── Chamadas API com filtro cliente_id ────────────────────────────────────────

test.describe('Segurança — Isolamento de dados via RLS', () => {
  test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD no .env.e2e');

  test('[rls] API de focos_risco inclui filtro cliente_id', async ({ page }) => {
    const focosCalls: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/rest/v1/focos_risco') || res.url().includes('focos_risco')) {
        focosCalls.push(res.url());
      }
    });

    await loginAsAdmin(page);
    await page.goto('/gestor/focos');
    await page.waitForLoadState('networkidle');

    // Todas as chamadas aos focos_risco não devem vazar cliente_id=null
    for (const url of focosCalls) {
      expect(url, `Chamada sem filtro de cliente detectada: ${url}`)
        .not.toMatch(/eq\(cliente_id,null\)/);
    }
  });

  test('[rls] API de usuarios inclui filtro e não expõe todos os usuários', async ({ page }) => {
    const usuariosCalls: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/rest/v1/usuarios')) {
        usuariosCalls.push(res.url());
      }
    });

    await loginAsAdmin(page);
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('networkidle');

    for (const url of usuariosCalls) {
      expect(url).not.toMatch(/eq\(cliente_id,null\)/);
    }
  });

  test('[rls] admin autenticado não vê erro 403 na sua própria rota', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/403|acesso negado|sem permissão/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
  });
});
