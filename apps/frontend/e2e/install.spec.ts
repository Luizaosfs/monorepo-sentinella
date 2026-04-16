import { test, expect } from "@playwright/test";

test.describe("Página de instalação PWA", () => {
  test("página /install carrega e exibe conteúdo de instalação", async ({ page }) => {
    await page.goto("/install");

    await expect(page.getByRole("heading", { name: /instale o app/i })).toBeVisible();
    await expect(page.getByText(/como instalar|ou siga os passos/i)).toBeVisible();
  });
});
