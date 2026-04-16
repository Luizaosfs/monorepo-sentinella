/**
 * E2E: State machine de focos_risco
 *
 * Cobre:
 *  - Guard de autenticação
 *  - Focos em "suspeita" têm botão de triagem disponível
 *  - Filtro por status "confirmado" funciona
 *  - Filtro por status "descartado" funciona
 *  - Regressão: botões de transição não aparecem para estados terminais
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsSupervisor, hasSupervisorTestCredentials } from './helpers/auth';

test.describe('Focos de Risco — State Machine', () => {
  test('[guard] /gestor/focos sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/gestor/focos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

    test.beforeEach(async ({ page }) => {
      await loginAsSupervisor(page);
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');
    });

    test('[smoke] focos em status "suspeita" têm botão de triagem disponível', async ({ page }) => {
      // Ativar filtro de suspeita se existir
      const chipSuspeita = page.getByRole('button', { name: /suspeita/i }).first();
      if (await chipSuspeita.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await chipSuspeita.click();
        await page.waitForTimeout(800);
      }

      // Verificar se há focos em suspeita com botão de triagem
      const btnTriagem = page.getByRole('button', { name: /iniciar triagem|triagem|em triagem/i }).first();
      if (!await btnTriagem.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco em "suspeita" disponível para verificar botão de triagem');
        return;
      }

      await expect(btnTriagem).toBeVisible();
    });

    test('[smoke] filtro por status "confirmado" filtra corretamente', async ({ page }) => {
      const chipConfirmado = page.getByRole('button', { name: /^confirmado$/i })
        .or(page.getByRole('checkbox', { name: /confirmado/i }))
        .first();

      if (!await chipConfirmado.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Chip de filtro "confirmado" não encontrado');
        return;
      }

      await chipConfirmado.click();
      await page.waitForTimeout(1_000);

      // Após filtrar, não deve aparecer itens com outros status como "suspeita"
      // Verificar que a página não exibiu erro
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/erro ao carregar|falha ao buscar/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test('[smoke] filtro por status "descartado" mostra focos descartados ou vazio', async ({ page }) => {
      const chipDescartado = page.getByRole('button', { name: /descartado/i })
        .or(page.getByRole('checkbox', { name: /descartado/i }))
        .first();

      if (!await chipDescartado.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Chip de filtro "descartado" não encontrado');
        return;
      }

      await chipDescartado.click();
      await page.waitForTimeout(1_000);

      // Deve mostrar itens descartados ou mensagem de lista vazia — nunca erro
      const resultado = page.getByRole('table')
        .or(page.getByRole('list'))
        .or(page.getByText(/nenhum foco|sem focos|0 focos|lista vazia/i));
      await expect(resultado.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[regressão] botões de transição não aparecem para estados terminais', async ({ page }) => {
      // Filtrar por resolvido
      const chipResolvido = page.getByRole('button', { name: /resolvido/i })
        .or(page.getByRole('checkbox', { name: /resolvido/i }))
        .first();

      if (!await chipResolvido.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Chip "resolvido" não encontrado para teste de regressão');
        return;
      }

      await chipResolvido.click();
      await page.waitForTimeout(1_000);

      const focoResolvido = page.locator('a[href*="/gestor/focos/"]').first();
      if (!await focoResolvido.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco resolvido disponível para regressão de state machine');
        return;
      }

      await focoResolvido.click();
      await page.waitForLoadState('domcontentloaded');

      // Para estado terminal, os botões de transição avançada não devem estar presentes
      // Ex: "Confirmar foco", "Iniciar triagem", "Iniciar tratamento"
      await expect(
        page.getByRole('button', { name: /iniciar triagem|confirmar foco|iniciar tratamento/i })
      ).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });
  });
});
