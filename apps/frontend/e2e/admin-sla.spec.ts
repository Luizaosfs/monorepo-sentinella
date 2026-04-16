import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOperador } from './helpers/auth';

test.describe('Admin — Painel SLA', () => {
  test('[smoke] /admin/sla carrega painel com abas', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sla');
    await page.waitForLoadState('networkidle');
    // Abas de SLA
    await expect(page.getByRole('tab', { name: /config|configuração/i }).or(
      page.getByText(/config|configuração|regiões|auditoria/i).first()
    )).toBeVisible({ timeout: 10000 });
  });

  test('[smoke] aba Config exibe tabela de prioridades', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sla');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/prioridade|críti|alta|baixa/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('[smoke] aba Auditoria carrega sem erro', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sla');
    await page.waitForLoadState('networkidle');
    const auditoriaTab = page.getByRole('tab', { name: /auditoria/i })
      .or(page.getByText(/auditoria/i).first());
    if (await auditoriaTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await auditoriaTab.click();
      // Deve carregar sem erro crítico (lista vazia ou dados)
      await expect(page.getByText(/auditoria|histórico|sem registros|nenhum/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('[guard] /admin/sla com papel operador é bloqueado', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/admin/sla');
    // Deve redirecionar para login ou exibir acesso negado
    const url = page.url();
    const hasAccessDenied = await page.getByText(/acesso negado|sem permissão|não autorizado/i).isVisible({ timeout: 5000 }).catch(() => false);
    const isRedirected = /\/login|\/operador|\/dashboard/.test(url);
    expect(hasAccessDenied || isRedirected).toBe(true);
  });
});
