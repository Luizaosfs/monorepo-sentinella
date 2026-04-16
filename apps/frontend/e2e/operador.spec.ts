import { test, expect } from "@playwright/test";

test.describe("Operador", () => {
  test("acessar /operador sem auth redireciona para /login", async ({ page }) => {
    await page.goto("/operador");
    await expect(page).toHaveURL(/\/login/);
  });
});
