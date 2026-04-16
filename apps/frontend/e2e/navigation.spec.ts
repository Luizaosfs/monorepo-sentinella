import { test, expect } from "@playwright/test";

test.describe("Navegação e rotas protegidas", () => {
  test("acessar / sem autenticação redireciona para /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login/);
  });

  test("acessar /levantamentos sem autenticação redireciona para /login", async ({ page }) => {
    await page.goto("/levantamentos");

    await expect(page).toHaveURL(/\/login/);
  });

  test("acessar /mapa sem autenticação redireciona para /login", async ({ page }) => {
    await page.goto("/mapa");

    await expect(page).toHaveURL(/\/login/);
  });

  test("acessar /admin sem autenticação redireciona para /login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/);
  });

  test("rota inexistente exibe página 404", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");

    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/page not found|não encontrada/i)).toBeVisible();
  });
});
