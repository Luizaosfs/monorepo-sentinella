import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOperador, loginAsNotificador } from './helpers/auth';

type AccessResult = 'allowed' | 'blocked';

async function checkAccess(page: import('@playwright/test').Page, path: string): Promise<AccessResult> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const url = page.url();
  const hasAccessDenied = await page.getByText(/acesso negado|sem permissão|não autorizado|403/i)
    .isVisible({ timeout: 3000 }).catch(() => false);
  const isOnLogin = /\/login/.test(url);
  const isRedirectedAway = !url.includes(path.split('?')[0].replace(/\/$/, ''));
  if (hasAccessDenied || isOnLogin || isRedirectedAway) return 'blocked';
  return 'allowed';
}

test.describe('Controle de acesso por papel', () => {
  test('admin acessa /admin/sla', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/admin/sla')).toBe('allowed');
  });

  test('operador é bloqueado em /admin/sla', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/admin/sla')).toBe('blocked');
  });

  test('admin acessa /admin/casos', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/admin/casos')).toBe('allowed');
  });

  test('operador é bloqueado em /admin/casos', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/admin/casos')).toBe('blocked');
  });

  test('admin acessa /admin/imoveis-problematicos', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/admin/imoveis-problematicos')).toBe('allowed');
  });

  test('operador é bloqueado em /admin/imoveis-problematicos', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/admin/imoveis-problematicos')).toBe('blocked');
  });

  test('admin acessa /operador/inicio', async ({ page }) => {
    await loginAsAdmin(page);
    // Admin pode ter acesso irrestrito — verifica apenas que não cai em login
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('operador acessa /operador/inicio', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/operador/inicio')).toBe('allowed');
  });

  test('notificador é bloqueado em /operador/inicio', async ({ page }) => {
    await loginAsNotificador(page);
    expect(await checkAccess(page, '/operador/inicio')).toBe('blocked');
  });

  test('admin acessa /notificador/registrar', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await checkAccess(page, '/notificador/registrar')).toBe('allowed');
  });

  test('notificador acessa /notificador/registrar', async ({ page }) => {
    await loginAsNotificador(page);
    expect(await checkAccess(page, '/notificador/registrar')).toBe('allowed');
  });

  test('operador é bloqueado em /notificador/registrar', async ({ page }) => {
    await loginAsOperador(page);
    expect(await checkAccess(page, '/notificador/registrar')).toBe('blocked');
  });
});
