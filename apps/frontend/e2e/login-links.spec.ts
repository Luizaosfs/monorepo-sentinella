import { test, expect } from "@playwright/test";

test.describe("Links na página de login", () => {
  test("link Instalar leva para /install", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /instalar/i }).click();

    await expect(page).toHaveURL(/\/install/);
  });

  test("na página de login existe link para instalação do app", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /instalar/i })).toBeVisible();
  });
});
