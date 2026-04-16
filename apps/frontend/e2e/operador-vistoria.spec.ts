import { test, expect } from '@playwright/test';
import { loginAsOperador, hasOperadorTestCredentials } from './helpers/auth';

test.describe('Operador — Início do Turno', () => {
  test('[smoke] /operador/inicio exibe saudação e stats do ciclo após login', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    // Deve haver alguma saudação (Bom dia / Boa tarde / Boa noite) ou nome do operador
    await expect(page.getByText(/bom dia|boa tarde|boa noite|olá/i).first()).toBeVisible({ timeout: 10000 });
    // Stats do ciclo presentes
    await expect(page.getByText(/ciclo|pendente|visitado/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Operador — Lista de Imóveis', () => {
  test('[smoke] /operador/imoveis lista imóveis e exibe campo de busca', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/imoveis');
    await page.waitForLoadState('networkidle');
    // Campo de busca ou filtro presente
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Operador — Fluxo de Vistoria', () => {
  test('[guard] /operador/vistoria/:imovelId sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/operador/vistoria/00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('[smoke] /operador/vistoria/:imovelId autenticado exibe tela de vistoria (não login)', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !hasOperadorTestCredentials(),
      'Defina TEST_OPERADOR_EMAIL e TEST_OPERADOR_PASSWORD em .env.e2e',
    );
    const imovelId =
      process.env.E2E_IMOVEL_ID?.trim() || '00000000-0000-0000-0000-000000000001';
    await loginAsOperador(page);
    await page.goto(`/operador/vistoria/${imovelId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByText(/vistoria|etapa|responsável|registro|imóvel|morador/i).first(),
    ).toBeVisible({ timeout: 20000 });
  });

  test('[validação] focos não podem exceder inspecionados na Etapa 3', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/imoveis');
    await page.waitForLoadState('networkidle');

    // Tenta navegar para vistoria de um imóvel (qualquer link de vistoria visível)
    const vistoriaLink = page.getByRole('link', { name: /visitar|vistoria|iniciar/i }).first();
    const hasLink = await vistoriaLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasLink) {
      // Sem imóveis disponíveis — pula o teste
      test.skip();
      return;
    }

    await vistoriaLink.click();
    // Avança para etapa 3 (Inspeção)
    const avancar = page.getByRole('button', { name: /próximo|avançar|continuar/i });
    if (await avancar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avancar.click(); // etapa 1 → 2
    }
    if (await avancar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avancar.click(); // etapa 2 → 3
    }

    // Na etapa 3, tenta colocar mais focos que inspecionados
    const inspecionados = page.locator('input[type="number"]').first();
    if (await inspecionados.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inspecionados.fill('2');
      const focos = page.locator('input[type="number"]').nth(1);
      if (await focos.isVisible({ timeout: 3000 }).catch(() => false)) {
        await focos.fill('5');
        await focos.blur();
        const value = await focos.inputValue();
        expect(Number(value)).toBeLessThanOrEqual(2);
      }
    }
  });
});

test.describe('Operador — Sem Acesso', () => {
  test('[smoke] fluxo de sem acesso exibe campo de motivo', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/imoveis');
    await page.waitForLoadState('networkidle');

    const vistoriaLink = page.getByRole('link', { name: /visitar|vistoria|iniciar/i }).first();
    const hasLink = await vistoriaLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasLink) { test.skip(); return; }

    await vistoriaLink.click();
    // Procura toggle de "sem acesso"
    const semAcessoToggle = page.getByRole('button', { name: /sem acesso|não conseguiu|acesso negado/i })
      .or(page.locator('label', { hasText: /conseguiu entrar/i }))
      .first();

    if (await semAcessoToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await semAcessoToggle.click();
      // Deve aparecer opções de motivo
      await expect(page.getByText(/fechado|recusa|ausente|motivo/i).first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});
