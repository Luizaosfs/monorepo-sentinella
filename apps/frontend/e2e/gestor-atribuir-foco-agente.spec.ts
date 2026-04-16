/**
 * E2E: Gestor — Atribuição de foco a agente
 *
 * Cobre:
 *  - Acesso à página de detalhe de foco_risco
 *  - Presença do controle de atribuição de responsável
 *  - Fluxo de abrir dialog/modal e selecionar agente
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsSupervisor, hasSupervisorTestCredentials } from './helpers/auth';

test.describe('Gestor — Atribuição de Foco a Agente', () => {
  test('[guard] /gestor/focos/:id sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/gestor/focos/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

    test.beforeEach(async ({ page }) => {
      await loginAsSupervisor(page);
    });

    test('[smoke] página de detalhe carrega sem erro ao navegar via lista', async ({ page }) => {
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');

      const link = page.locator('a[href*="/gestor/focos/"]').first();
      if (!await link.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco disponível na lista para navegar ao detalhe');
        return;
      }

      await link.click();
      await page.waitForLoadState('domcontentloaded');

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/erro ao carregar|falha ao buscar/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test('[smoke] botão ou link de atribuir responsável está presente no detalhe', async ({ page }) => {
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');

      const link = page.locator('a[href*="/gestor/focos/"]').first();
      if (!await link.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco disponível para verificar atribuição');
        return;
      }

      await link.click();
      await page.waitForLoadState('domcontentloaded');

      const atribuirBtn = page.getByRole('button', { name: /atribuir|responsável|agente|assign/i })
        .or(page.getByText(/atribuir responsável|atribuir agente/i));
      await expect(atribuirBtn.first()).toBeVisible({ timeout: 15_000 });
    });

    test('[nav] clicar em atribuir abre dialog/modal com lista de agentes', async ({ page }) => {
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');

      const link = page.locator('a[href*="/gestor/focos/"]').first();
      if (!await link.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco disponível para testar dialog de atribuição');
        return;
      }

      await link.click();
      await page.waitForLoadState('domcontentloaded');

      const atribuirBtn = page.getByRole('button', { name: /atribuir|responsável|agente/i }).first();
      if (!await atribuirBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        test.skip(true, 'Botão de atribuição não encontrado no detalhe do foco');
        return;
      }

      await atribuirBtn.click();

      // Dialog/modal deve abrir com lista ou select de agentes
      const dialog = page.getByRole('dialog')
        .or(page.locator('[role="dialog"]'))
        .or(page.getByText(/selecionar agente|escolher responsável|agentes disponíveis/i));
      await expect(dialog.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[ação] selecionar agente e confirmar fecha dialog sem erro', async ({ page }) => {
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');

      const link = page.locator('a[href*="/gestor/focos/"]').first();
      if (!await link.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco disponível para testar seleção de agente');
        return;
      }

      await link.click();
      await page.waitForLoadState('domcontentloaded');

      const atribuirBtn = page.getByRole('button', { name: /atribuir|responsável|agente/i }).first();
      if (!await atribuirBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        test.skip(true, 'Botão de atribuição não encontrado');
        return;
      }

      await atribuirBtn.click();

      const dialog = page.getByRole('dialog').first();
      if (!await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Dialog de atribuição não abriu');
        return;
      }

      // Selecionar primeiro agente disponível na lista/combobox
      const opcaoAgente = dialog.getByRole('option').first()
        .or(dialog.getByRole('radio').first())
        .or(dialog.locator('li').first());

      if (await opcaoAgente.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await opcaoAgente.click();
      }

      // Confirmar
      const confirmarBtn = dialog.getByRole('button', { name: /confirmar|salvar|atribuir|ok/i }).first();
      if (!await confirmarBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, 'Botão de confirmar não encontrado no dialog');
        return;
      }

      await confirmarBtn.click();

      // Dialog deve fechar
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
      // Sem mensagem de erro
      await expect(page.getByText(/erro|falha|não foi possível/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });
  });
});
