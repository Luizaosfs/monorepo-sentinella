import { test, expect } from "@playwright/test";

test.describe("Página de login", () => {
  test(
    "exibe formulário de login ao acessar /login",
    { tag: "@smoke" },
    async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /senha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
    },
  );

  test("exibe mensagem de erro ao enviar credenciais inválidas", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("textbox", { name: /email/i }).fill("invalido@teste.com");
    await page.getByRole("textbox", { name: /senha/i }).fill("senhaerrada");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page.getByText(/email ou senha inválidos|erro ao fazer login/i)).toBeVisible({ timeout: 10000 });
  });

  test("link Esqueci minha senha alterna para formulário de recuperação", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /esqueci minha senha/i }).click();

    await expect(page.getByRole("heading", { name: /esqueceu sua senha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar link de redefinição/i })).toBeVisible();
  });

  test("voltar ao login a partir do formulário de esqueci senha", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /esqueci minha senha/i }).click();

    await page.getByRole("button", { name: /voltar ao login/i }).click();

    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });
});
