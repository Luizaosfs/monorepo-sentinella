import { test, expect } from '@playwright/test';
import { hasAdminTestCredentials, loginAsAdmin } from './helpers/auth';

/**
 * Smoke: rotas admin/gestor adicionadas após o núcleo inicial de e2e.
 * Requer TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD no ambiente.
 */
test.describe('Admin + gestor — rotas adicionais', () => {
  test.beforeEach(({ }, testInfo) => {
    testInfo.skip(
      !hasAdminTestCredentials(),
      'Defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD para estes testes',
    );
  });

  test('admin acessa central operacional e triagem', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/gestor/central');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('/gestor/triagem');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin acessa pipeline, painel executivo, ciclos e reincidência', async ({ page }) => {
    await loginAsAdmin(page);
    for (const path of [
      '/admin/pipeline-status',
      '/admin/executivo',
      '/admin/ciclos',
      '/admin/reincidencia',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test('admin acessa score-config e eficácia-tratamentos', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/score-config');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('/admin/eficacia-tratamentos');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
