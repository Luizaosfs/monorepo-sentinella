import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const IMAGES_DIR = "docs/user-guide/images";
const SCREENSHOT_PLAN_PATH = "docs/user-guide/screenshots-pendentes.md";

const DOC_USER_EMAIL = process.env.DOC_USER_EMAIL ?? "";
const DOC_USER_PASSWORD = process.env.DOC_USER_PASSWORD ?? "";

// Rotas dinâmicas do plano (preencher para conseguir capturar essas telas)
const E2E_IMOVEL_ID = process.env.E2E_IMOVEL_ID ?? "";
const E2E_DENUNCIA_SLUG = process.env.E2E_DENUNCIA_SLUG ?? "";
const E2E_DENUNCIA_BAIRRO_ID = process.env.E2E_DENUNCIA_BAIRRO_ID ?? "";

type PlanRow = {
  ordem: number;
  modulo: string;
  tela: string;
  rota: string;
  arquivo: string;
  tipo: string;
  oQue: string;
  observacoes: string;
};

function hasDocLogin(): boolean {
  return Boolean(DOC_USER_EMAIL && DOC_USER_PASSWORD);
}

function ensureImagesDir() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function isProbablyProtectedRoute(route: string): boolean {
  return (
    route.startsWith("/dashboard") ||
    route.startsWith("/levantamentos") ||
    route.startsWith("/mapa") ||
    route.startsWith("/operador") ||
    route.startsWith("/admin") ||
    route.startsWith("/notificador")
  );
}

function resolveDynamicRoute(route: string): { ok: boolean; resolved: string; reason?: string } {
  if (!route.includes(":")) return { ok: true, resolved: route };

  let resolved = route;

  if (resolved.includes(":imovelId")) {
    if (!E2E_IMOVEL_ID) return { ok: false, resolved: route, reason: "E2E_IMOVEL_ID não definido" };
    resolved = resolved.replaceAll(":imovelId", E2E_IMOVEL_ID);
  }

  if (resolved.includes(":slug") || resolved.includes(":bairroId")) {
    if (!E2E_DENUNCIA_SLUG || !E2E_DENUNCIA_BAIRRO_ID) {
      return { ok: false, resolved: route, reason: "E2E_DENUNCIA_SLUG/E2E_DENUNCIA_BAIRRO_ID não definidos" };
    }
    resolved = resolved.replaceAll(":slug", E2E_DENUNCIA_SLUG).replaceAll(":bairroId", E2E_DENUNCIA_BAIRRO_ID);
  }

  if (resolved.includes(":")) {
    return { ok: false, resolved: route, reason: "Ainda contém parâmetro dinâmico" };
  }

  return { ok: true, resolved };
}

function parsePlanMarkdown(markdown: string): PlanRow[] {
  const lines = markdown.split(/\r?\n/);
  const rows: PlanRow[] = [];

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("| Ordem |")) continue;
    if (line.includes("|------")) continue;

    // remove bordas e divide em colunas
    const cols = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    if (cols.length < 8) continue;

    const [ordemRaw, modulo, tela, rota, arquivoRaw, tipo, oQue, observacoes] = cols;
    const ordem = Number(ordemRaw);
    if (!Number.isFinite(ordem)) continue;

    const arquivo = arquivoRaw.replaceAll("`", "");
    const rotaClean = rota.replaceAll("`", "");

    rows.push({
      ordem,
      modulo,
      tela,
      rota: rotaClean,
      arquivo,
      tipo,
      oQue,
      observacoes,
    });
  }

  return rows.sort((a, b) => a.ordem - b.ordem);
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DOC_USER_EMAIL);
  await page.locator("#password").fill(DOC_USER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login/i);
}

async function applyBestEffortPreCaptureSteps(page: import("@playwright/test").Page, row: PlanRow) {
  // Ajuda para prints de seções da landing page (sem depender de seletores frágeis).
  if (row.arquivo === "public-landing-cta.png") {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  if (row.arquivo === "public-landing-funcionalidades.png" || row.arquivo === "public-landing-como-funciona.png") {
    await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.35)));
    await page.waitForTimeout(300);
  }
}

function resolveSpecialRoutes(rawRoute: string): string | null {
  // Rota "qualquer" = capturar navegação/menus em uma tela interna padrão.
  if (rawRoute === "qualquer") return "/dashboard";
  // "qualquer rota inexistente" = forçar 404 com uma rota que não existe.
  if (rawRoute.includes("qualquer rota inexistente")) return "/__rota-inexistente__";
  return null;
}

test.describe("Screenshots para documentação (docs/user-guide)", () => {
  test("gera screenshots a partir do screenshots-pendentes.md", async ({ page }) => {
    // 125+ capturas em fullPage podem levar vários minutos, dependendo do PC e do backend.
    test.setTimeout(30 * 60_000);
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(30_000);

    ensureImagesDir();

    const markdown = fs.readFileSync(SCREENSHOT_PLAN_PATH, "utf-8");
    const plan = parsePlanMarkdown(markdown);
    expect(plan.length).toBeGreaterThan(0);

    let loggedIn = false;

    for (const row of plan) {
      // Ignorar linhas que não são uma rota navegável
      const special = resolveSpecialRoutes(row.rota);
      const routeCandidate = special ?? row.rota;
      if (!routeCandidate.startsWith("/")) continue;

      const resolvedRoute = resolveDynamicRoute(routeCandidate);
      if (!resolvedRoute.ok) {
        // pula rotas dinâmicas sem parâmetros
        continue;
      }

      // Login sob demanda para rotas protegidas
      if (isProbablyProtectedRoute(resolvedRoute.resolved) && hasDocLogin() && !loggedIn) {
        await login(page);
        loggedIn = true;
      }

      // Se for rota protegida mas não temos login, pula.
      if (isProbablyProtectedRoute(resolvedRoute.resolved) && !hasDocLogin()) {
        continue;
      }

      await page.goto(resolvedRoute.resolved, { waitUntil: "domcontentloaded" });
      // Algumas telas mantêm requests em background (polling/webpush/etc).
      // Para screenshot, "domcontentloaded" + um networkidle curto já é suficiente.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(300);
      await applyBestEffortPreCaptureSteps(page, row);

      const outPath = path.join(IMAGES_DIR, row.arquivo);
      if (fs.existsSync(outPath)) {
        continue;
      }
      await page.screenshot({ path: outPath, fullPage: true });
    }
  });
});
