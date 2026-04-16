import { test, expect } from '@playwright/test';

test.describe('Canal Cidadão — Página Pública', () => {
  const slug = process.env.TEST_CANAL_SLUG ?? 'TRES LAGOAS - MS';
  const bairroId = process.env.TEST_CANAL_BAIRRO_ID ?? '0bb59a94-14a0-4ad8-8ca7-a3db8d79c45c';

  const publicDenunciaUrl = `/denuncia/${encodeURIComponent(slug)}/${bairroId}`;

  test('[smoke] resposta HTTP 2xx (sem erro de servidor)', async ({ page }) => {
    const response = await page.goto(publicDenunciaUrl, { waitUntil: 'domcontentloaded' });
    expect(response, 'navegação deve retornar Response').toBeTruthy();
    expect(response!.status(), 'não deve ser 5xx').toBeLessThan(500);
    expect(response!.ok(), 'deve ser 2xx').toBeTruthy();
  });

  test('[smoke] página pública de denúncia carrega sem autenticação', async ({ page }) => {
    await page.goto(publicDenunciaUrl);
    await page.waitForLoadState('networkidle');
    // Deve carregar sem redirecionar para login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('[smoke] exibe formulário com campo de descrição e botão enviar', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(slug)}/${bairroId}`);
    await page.waitForLoadState('networkidle');
    // Campo de descrição ou textarea
    await expect(
      page.getByRole('textbox').or(page.locator('textarea')).first()
    ).toBeVisible({ timeout: 10000 });
    // Botão de envio
    await expect(
      page.getByRole('button', { name: /enviar|registrar|denunciar|enviar denúncia/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('[smoke] aviso de privacidade LGPD está visível', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(slug)}/${bairroId}`);
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/lgpd|privacidade|dados pessoais|lei geral/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('[validação] envio com campo vazio exibe mensagem de erro', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(slug)}/${bairroId}`);
    await page.waitForLoadState('networkidle');
    const submitBtn = page.getByRole('button', { name: /enviar|registrar|denunciar/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      await expect(
        page.getByText(/obrigatório|preencha|campo|required/i).first()
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
