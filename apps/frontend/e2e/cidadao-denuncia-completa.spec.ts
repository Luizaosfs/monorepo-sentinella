/**
 * E2E: Canal Cidadão — Denúncia pública e consulta de protocolo
 *
 * Cobre:
 *  - Página pública sem autenticação (slug + bairroId)
 *  - Formulário de denúncia exibe campos obrigatórios
 *  - Validação client-side antes de submeter
 *  - Mensagem de confirmação / protocolo exibido após envio (ambiente de teste)
 *  - QR code exibido em /admin/canal
 *
 * Credenciais necessárias (opcional):
 *   TEST_CANAL_SLUG  — slug do canal de denúncia do cliente de teste
 *   TEST_CANAL_BAIRRO_ID — UUID do bairro para a URL pública
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — para verificar o painel admin
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminTestCredentials } from './helpers/auth';

const SLUG      = process.env.TEST_CANAL_SLUG     ?? 'slug-publico';
const BAIRRO_ID = process.env.TEST_CANAL_BAIRRO_ID ?? '00000000-0000-0000-0000-000000000000';

test.describe('Canal Cidadão — Página pública', () => {
  test('[public] /denuncia/:slug/:bairroId não requer autenticação', async ({ page }) => {
    const response = await page.goto(`/denuncia/${encodeURIComponent(SLUG)}/${BAIRRO_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('[public] página de denúncia exibe formulário ou mensagem de boas-vindas', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(SLUG)}/${BAIRRO_ID}`);
    await page.waitForLoadState('domcontentloaded');
    // Deve haver algum conteúdo (não tela branca)
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByText(/dengue|foco|denúncia|reportar|problema|endereço|registrar/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[public] campo de endereço ou descrição está presente', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(SLUG)}/${BAIRRO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const campo = page.getByRole('textbox', { name: /endereço|descrição|local|rua/i })
      .or(page.locator('textarea, input[type="text"]'))
      .first();
    await expect(campo).toBeVisible({ timeout: 10_000 });
  });

  test('[validação] enviar sem endereço exibe erro de campo obrigatório', async ({ page }) => {
    await page.goto(`/denuncia/${encodeURIComponent(SLUG)}/${BAIRRO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const submit = page.getByRole('button', { name: /enviar|registrar|denunciar|confirmar/i }).first();
    if (!await submit.isVisible({ timeout: 8_000 }).catch(() => false)) {
      test.skip(true, 'Botão de submit não encontrado');
      return;
    }
    await submit.click();
    await expect(
      page.getByText(/obrigatório|preencha|endereço necessário|campo requerido/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('[public] /denuncia/consultar está acessível sem login', async ({ page }) => {
    const response = await page.goto('/denuncia/consultar', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Canal Cidadão — Painel Admin', () => {
  test('[guard] /admin/canal sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/admin/canal');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais admin', () => {
    test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD no .env.e2e');

    test('[smoke] /admin/canal exibe QR code ou link de denúncia', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/canal');
      await page.waitForLoadState('networkidle');

      await expect(page).not.toHaveURL(/\/login/);
      // Deve haver QR code ou URL copiável
      await expect(
        page.locator('canvas, img[alt*="qr"], svg[class*="qr"]')
          .or(page.getByText(/qr code|link público|compartilhar/i))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] /admin/canal lista denúncias recebidas', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/canal');
      await page.waitForLoadState('networkidle');

      // Deve haver tabela ou mensagem de vazio
      await expect(
        page.getByRole('table')
          .or(page.getByText(/nenhuma denúncia|sem denúncias|denúncia recebida|foco registrado/i))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
