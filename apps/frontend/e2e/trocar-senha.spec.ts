import { test, expect } from "@playwright/test";

test.describe("Trocar senha", () => {
  test("acessar /trocar-senha sem auth redireciona para /login", async ({ page }) => {
    await page.goto("/trocar-senha");
    await expect(page).toHaveURL(/\/login/);
  });
});
