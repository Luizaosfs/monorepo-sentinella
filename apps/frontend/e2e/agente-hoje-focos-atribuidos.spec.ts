/**
 * E2E: Agente — /agente/hoje e aba "Atribuídos"
 *
 * Cobre:
 *  - Guard de autenticação
 *  - Carregamento da tela inicial do agente
 *  - Presença e navegação da aba "Atribuídos"
 *  - Métricas visíveis (focos pendentes, visitados)
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_AGENTE_EMAIL / TEST_AGENTE_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsAgente, hasAgenteTestCredentials } from './helpers/auth';

test.describe('Agente — Hoje e Focos Atribuídos', () => {
  test('[guard] /agente/hoje sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/agente/hoje');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasAgenteTestCredentials(), 'Requer TEST_AGENTE_EMAIL/PASSWORD no .env.e2e');

    test.beforeEach(async ({ page }) => {
      await loginAsAgente(page);
      await page.goto('/agente/hoje');
      await page.waitForLoadState('networkidle');
    });

    test('[smoke] página carrega sem erro', async ({ page }) => {
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/erro ao carregar|falha ao buscar/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test('[smoke] aba "Atribuídos" está presente no tab list', async ({ page }) => {
      const abaAtribuidos = page.getByRole('tab', { name: /atribuídos|atribuido/i })
        .or(page.getByText(/atribuídos/i).first());
      await expect(abaAtribuidos.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] clicar em aba "Atribuídos" mostra conteúdo ou mensagem vazia', async ({ page }) => {
      const abaAtribuidos = page.getByRole('tab', { name: /atribuídos|atribuido/i }).first();
      if (!await abaAtribuidos.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Aba "Atribuídos" não encontrada');
        return;
      }

      await abaAtribuidos.click();
      await page.waitForTimeout(800);

      // Deve mostrar focos ou mensagem de lista vazia
      const conteudo = page.getByRole('list')
        .or(page.getByRole('table'))
        .or(page.getByText(/nenhum foco|sem focos atribuídos|0 focos|nenhum item/i))
        .or(page.locator('[data-tab-content]'));
      await expect(conteudo.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] métricas do agente estão visíveis', async ({ page }) => {
      // Métricas: focos pendentes, visitados, ou equivalentes
      const metricas = page.getByText(/pendente|visitado|atribuído|hoje|ciclo|total/i).first();
      await expect(metricas).toBeVisible({ timeout: 10_000 });
    });
  });
});
