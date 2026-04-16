import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsNotificador } from './helpers/auth';

test.describe('Admin — Centro de Notificações', () => {
  test('[smoke] /admin/casos carrega tabela com filtros', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/casos');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/caso|notificaç|dengue|status/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('[smoke] tabela exibe colunas de dados relevantes', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/casos');
    await page.waitForLoadState('networkidle');
    // Deve ter pelo menos um dos termos de coluna visível
    await expect(
      page.getByText(/doença|status|bairro|data/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('[guard] /notificador/registrar com papel admin permite acesso', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/notificador/registrar');
    await page.waitForLoadState('networkidle');
    // Não deve redirecionar para login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
  });

  test('[guard] /notificador/registrar sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/notificador/registrar');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
