import { test, expect } from "@playwright/test";

test.describe("Página de redefinição de senha", () => {
  test("página /reset-password carrega", async ({ page }) => {
    await page.goto("/reset-password");

    // Sem token de recuperação: após um tempo mostra "Link inválido ou expirado"
    // Ou durante loading mostra spinner
    await expect(
      page.getByText(/redefinir senha|link inválido ou expirado|nova senha/i)
    ).toBeVisible({ timeout: 8000 });
  });

  test("botão Voltar ao login aparece quando link é inválido", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByRole("button", { name: /voltar ao login/i })).toBeVisible({
      timeout: 8000,
    });
  });
});
