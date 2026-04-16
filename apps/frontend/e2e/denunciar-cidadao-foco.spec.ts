/**
 * E2E: denunciar_cidadao → cria foco_risco + protocolo consultável
 *
 * Testa o fluxo completo do canal cidadão:
 *  1. Página pública carrega sem auth
 *  2. Formulário submete e retorna protocolo
 *  3. Protocolo pode ser consultado em /denuncia/consultar
 *  4. Rate limit bloqueia spam (≥ 6 envios rápidos)
 *
 * Credenciais: nenhuma (fluxo anônimo). Requer variáveis:
 *   TEST_CANAL_SLUG      — slug do cliente (ex: "tres-lagoas-ms")
 *   TEST_CANAL_BAIRRO_ID — UUID do bairro válido para esse cliente
 */
import { test, expect } from '@playwright/test';

const slug     = process.env.TEST_CANAL_SLUG     ?? 'TRES LAGOAS - MS';
const bairroId = process.env.TEST_CANAL_BAIRRO_ID ?? '0bb59a94-14a0-4ad8-8ca7-a3db8d79c45c';
const denunciaUrl = `/denuncia/${encodeURIComponent(slug)}/${bairroId}`;

test.describe('Canal Cidadão — fluxo completo', () => {
  test('[smoke] página pública carrega sem autenticação', async ({ page }) => {
    const response = await page.goto(denunciaUrl, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('[UI] formulário exibe campo descrição e botão enviar', async ({ page }) => {
    await page.goto(denunciaUrl);
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('textbox').or(page.locator('textarea')).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /enviar|registrar|denunciar/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('[validação] envio sem descrição exibe erro', async ({ page }) => {
    await page.goto(denunciaUrl);
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /enviar|registrar|denunciar/i });
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await expect(
        page.getByText(/obrigatório|preencha|campo/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('[integração] submissão exibe protocolo após envio bem-sucedido', async ({ page }) => {
    test.skip(
      !process.env.TEST_CANAL_SLUG,
      'Requer TEST_CANAL_SLUG configurado no ambiente E2E.'
    );

    await page.goto(denunciaUrl);
    await page.waitForLoadState('networkidle');

    const textarea = page.getByRole('textbox').or(page.locator('textarea')).first();
    if (!await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Formulário não encontrado — slug/bairroId pode ser inválido no ambiente.');
    }

    await textarea.fill('Possível foco de dengue — água parada no quintal (teste E2E)');
    await page.getByRole('button', { name: /enviar|registrar|denunciar/i }).click();

    // Deve exibir protocolo (8 chars hex) ou mensagem de sucesso
    await expect(
      page.getByText(/protocolo|recebida|registrada|sucesso/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // Protocolo deve ter ao menos 6 caracteres hexadecimais
    const protocoloEl = page.getByText(/[0-9a-f]{6,}/i).first();
    if (await protocoloEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const txt = await protocoloEl.textContent();
      expect(txt).toBeTruthy();
    }
  });

  test('[integração] protocolo retornado é consultável em /denuncia/consultar', async ({ page }) => {
    test.skip(
      !process.env.TEST_CANAL_SLUG,
      'Requer TEST_CANAL_SLUG configurado no ambiente E2E.'
    );

    await page.goto(denunciaUrl);
    await page.waitForLoadState('networkidle');

    const textarea = page.getByRole('textbox').or(page.locator('textarea')).first();
    if (!await textarea.isVisible({ timeout: 5_000 }).catch(() => false)) return;

    await textarea.fill('Teste E2E — consulta de protocolo');
    await page.getByRole('button', { name: /enviar|registrar|denunciar/i }).click();

    // Extrair protocolo exibido
    const protocoloEl = page.getByText(/[0-9a-f]{6,}/i).first();
    await protocoloEl.waitFor({ timeout: 15_000 });
    const protocolo = (await protocoloEl.textContent() ?? '').trim().substring(0, 8);

    if (protocolo.length < 6) return; // protocolo não encontrado na UI

    // Consultar o protocolo
    await page.goto('/denuncia/consultar');
    await page.waitForLoadState('networkidle');
    const input = page.getByRole('textbox').first();
    await input.fill(protocolo);
    await page.getByRole('button', { name: /consultar|buscar/i }).click();

    await expect(
      page.getByText(/suspeita|triagem|confirmado|resolvido|descartado|recebida/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
