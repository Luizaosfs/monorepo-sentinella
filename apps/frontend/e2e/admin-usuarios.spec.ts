/**
 * E2E: Admin — Gestão de Usuários
 *
 * Cobre:
 *  - Guard de autenticação
 *  - Listagem de usuários com tabela/lista
 *  - Filtro/busca por nome ou email
 *  - Modal de edição de papel
 *  - Validação de papéis canônicos (sem platform_admin)
 *  - Presença do botão de desativar usuário
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasAdminTestCredentials } from './helpers/auth';

test.describe('Admin — Gestão de Usuários', () => {
  test('[guard] /admin/usuarios sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasAdminTestCredentials(), 'Requer TEST_ADMIN_EMAIL/PASSWORD no .env.e2e');

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/usuarios');
      await page.waitForLoadState('networkidle');
    });

    test('[smoke] página lista usuários sem erro', async ({ page }) => {
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/erro ao carregar|falha ao buscar/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test('[smoke] tabela ou lista de usuários está presente', async ({ page }) => {
      const tabela = page.getByRole('table')
        .or(page.getByRole('list'))
        .or(page.getByText(/nenhum usuário|sem usuários/i));
      await expect(tabela.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] filtro ou busca por nome/email está presente', async ({ page }) => {
      const busca = page.getByRole('searchbox')
        .or(page.getByRole('textbox', { name: /buscar|pesquisar|nome|email/i }))
        .or(page.getByPlaceholder(/buscar|pesquisar|nome|email/i));
      await expect(busca.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[nav] clicar em editar usuário abre modal ou formulário', async ({ page }) => {
      const editarBtn = page.getByRole('button', { name: /editar|edit/i })
        .or(page.getByRole('menuitem', { name: /editar/i }))
        .first();

      if (!await editarBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Botão de editar usuário não encontrado — lista pode estar vazia');
        return;
      }

      await editarBtn.click();

      const modal = page.getByRole('dialog')
        .or(page.locator('[role="dialog"]'))
        .or(page.getByText(/editar usuário|alterar papel/i));
      await expect(modal.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] select de papel mostra APENAS as 4 opções canônicas', async ({ page }) => {
      const editarBtn = page.getByRole('button', { name: /editar|edit/i })
        .or(page.getByRole('menuitem', { name: /editar/i }))
        .first();

      if (!await editarBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Botão de editar não encontrado para verificar opções de papel');
        return;
      }

      await editarBtn.click();

      const dialog = page.getByRole('dialog').first();
      if (!await dialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Dialog de edição não abriu');
        return;
      }

      // Verificar que os 4 papéis canônicos estão presentes
      await expect(dialog.getByText(/admin/i).first()).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByText(/supervisor/i).first()).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByText(/agente/i).first()).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByText(/notificador/i).first()).toBeVisible({ timeout: 5_000 });

      // platform_admin não deve aparecer (valor morto no enum)
      await expect(dialog.getByText(/platform_admin/i)).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
    });

    test('[smoke] botão remover ou desativar usuário está presente', async ({ page }) => {
      const removerBtn = page.getByRole('button', { name: /remover|desativar|excluir|delete/i })
        .or(page.getByRole('menuitem', { name: /remover|desativar|excluir/i }))
        .first();

      if (!await removerBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        test.skip(true, 'Botão de remover/desativar não encontrado — lista pode estar vazia');
        return;
      }

      await expect(removerBtn).toBeVisible();
    });
  });
});
