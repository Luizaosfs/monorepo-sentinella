import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/** Credenciais E2E (TEST_ADMIN_*, SERVER_URL, etc.) — ver `.env.e2e` na raiz. */
loadEnv({ path: resolve(process.cwd(), ".env.e2e") });

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const baseURL = process.env.SERVER_URL ?? `http://localhost:${PORT}`;
/** Só desliga o `webServer` quando SERVER_URL aponta para ambiente remoto (ex.: staging). Localhost continua com `npm run dev` automático. */
const startServer =
  process.env.E2E_SKIP_WEB_SERVER !== "1" &&
  (!process.env.SERVER_URL || isLocalhostUrl(process.env.SERVER_URL));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(startServer && {
    webServer: {
      /** Mesmo projeto Supabase que `.env.e2e` (Vite carrega `.env` + `.env.e2e` em `--mode e2e`). */
      command: "npm run dev:e2e",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
});
