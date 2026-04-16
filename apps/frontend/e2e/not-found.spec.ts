import { test, expect } from '@playwright/test';

test.describe('Rota inexistente', () => {
  test('exibe página 404 sem autenticação', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/rota-que-nao-existe-sentinelaweb-test');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/404|não encontrad|not found/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
