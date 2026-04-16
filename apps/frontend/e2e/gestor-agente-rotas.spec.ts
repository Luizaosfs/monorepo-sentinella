import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOperador, loginAsNotificador } from './helpers/auth';

type AccessResult = 'allowed' | 'blocked';

async function checkAccess(
  page: import('@playwright/test').Page,
  path: string
): Promise<AccessResult> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const url = page.url();
  const hasAccessDenied = await page
    .getByText(/acesso negado|sem permissão|não autorizado|403/i)
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  const isOnLogin = /\/login/.test(url);
  const isRedirectedAway = !url.includes(path.split('?')[0].replace(/\/$/, ''));
  if (hasAccessDenied || isOnLogin || isRedirectedAway) return 'blocked';
  return 'allowed';
}

test.describe('Gestor — controle de acesso', () => {
  test('admin acessa /gestor/focos', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/gestor/focos')).toBe('allowed');
  });

  test('operador é bloqueado em /gestor/focos', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/gestor/focos')).toBe('blocked');
  });

  test('notificador é bloqueado em /gestor/focos', async ({ page }) => {
    await loginAsNotificador(page);
    expect(await checkAccess(page, '/gestor/focos')).toBe('blocked');
  });

  test('admin acessa /gestor/mapa', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/gestor/mapa')).toBe('allowed');
  });

  test('operador é bloqueado em /gestor/mapa', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/gestor/mapa')).toBe('blocked');
  });
});

test.describe('Agente — controle de acesso', () => {
  test('operador acessa /agente/hoje', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/agente/hoje')).toBe('allowed');
  });

  test('notificador é bloqueado em /agente/hoje', async ({ page }) => {
    await loginAsNotificador(page);
    expect(await checkAccess(page, '/agente/hoje')).toBe('blocked');
  });

  test('[guard] /agente/vistoria/:id sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/agente/vistoria/00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe('Notificador — guard por URL direta (S-03)', () => {
  test('notificador acessa /notificador normalmente', async ({ page }) => {
    await loginAsNotificador(page);
    expect(await checkAccess(page, '/notificador')).toBe('allowed');
  });

  test('operador é bloqueado em /notificador por acesso direto', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/notificador')).toBe('blocked');
  });

  test('operador é bloqueado em /notificador/registrar por acesso direto', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/notificador/registrar')).toBe('blocked');
  });

  test('admin acessa /notificador/registrar (suporte)', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/notificador/registrar')).toBe('allowed');
  });
});
