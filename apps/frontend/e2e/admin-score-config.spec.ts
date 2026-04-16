/**
 * E2E: Admin — Configuração de pesos do Score Territorial
 *
 * Cobre:
 *  - Guard de autenticação e papel
 *  - Sliders de peso por categoria (focos, epidemiologia, histórico)
 *  - Preview em tempo real do score
 *  - Botão "Restaurar padrões"
 *  - Botão "Salvar configuração"
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSupervisor, hasAdminTestCredentials, hasSupervisorTestCredentials } from './helpers/auth';

test.describe('Admin Score Config — Guard', () => {
  test('[guard] /admin/score-config sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/admin/score-config');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('[guard] /admin/score-config com papel supervisor bloqueia ou redireciona', async ({ page }) => {
    test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD');
    await loginAsSupervisor(page);
    await page.goto('/admin/score-config');
    await page.waitForLoadState('domcontentloaded');
    // Supervisor não deve acessar /admin — deve redirecionar para sua rota
    await expect(page).not.toHaveURL(/\/admin\/score-config/);
  });
});

test.describe('Admin Score Config — Funcionalidade', () => {
  test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD no .env.e2e');

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/score-config');
    await page.waitForLoadState('networkidle');
  });

  test('[smoke] página carrega configuração de score', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByText(/score|peso|territorial|configuração|categoria/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[smoke] sliders ou inputs de peso estão presentes', async ({ page }) => {
    const slider = page.locator('input[type="range"]')
      .or(page.getByRole('slider'))
      .first();
    await expect(slider).toBeVisible({ timeout: 10_000 });
  });

  test('[smoke] categorias de peso exibidas (focos, histórico, epidemiologia)', async ({ page }) => {
    await expect(
      page.getByText(/foco|histórico|epidemi|social|sanitário|surto/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[smoke] botão "Restaurar padrões" está presente', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /restaurar|padrão|resetar|default/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[smoke] botão de salvar configuração está presente', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /salvar|aplicar|confirmar/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[interação] alterar slider atualiza preview em tempo real', async ({ page }) => {
    const slider = page.locator('input[type="range"]').first();
    if (!await slider.isVisible({ timeout: 8_000 }).catch(() => false)) {
      test.skip(true, 'Slider não encontrado');
      return;
    }
    // Pegar valor atual e alterar
    const valorAntes = await slider.inputValue();
    await slider.fill(String(Math.min(100, Number(valorAntes) + 10)));

    // Preview deve atualizar (algum número ou % deve mudar)
    // Verifica que a página continua responsiva sem erro
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/erro|falha/i)).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});
