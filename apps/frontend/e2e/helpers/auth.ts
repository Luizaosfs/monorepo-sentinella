import { Page } from '@playwright/test';

/** Rotas após login com sucesso (Login.tsx → /dashboard e QueryRedirect pode mandar para operador/notificador etc.). */
const POST_LOGIN =
  /\/(dashboard|operador|admin|notificador|agente|gestor|mapa|levantamentos|trocar-senha)(\/|$)/;

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /senha/i }).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();

  const loginErro = page.getByText(/email ou senha inválidos|ainda não confirmado/i);
  const resultado = await Promise.race([
    page.waitForURL(POST_LOGIN, { timeout: 25_000 }).then(() => 'ok' as const),
    loginErro.waitFor({ state: 'visible', timeout: 25_000 }).then(() => 'erro' as const),
  ]);

  if (resultado === 'erro') {
    throw new Error(
      'E2E: falha no login (mensagem na tela). Confira email/senha no Supabase e variáveis TEST_* em .env.e2e.',
    );
  }
}

/** E2E: defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD (ex.: `.env` na raiz carregado pelo Playwright ou export no shell). */
export function hasAdminTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_ADMIN_EMAIL?.trim() && process.env.TEST_ADMIN_PASSWORD?.trim(),
  );
}

export function hasOperadorTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_OPERADOR_EMAIL?.trim() && process.env.TEST_OPERADOR_PASSWORD?.trim(),
  );
}

export function hasNotificadorTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_NOTIF_EMAIL?.trim() && process.env.TEST_NOTIF_PASSWORD?.trim(),
  );
}

/** Supervisor do cliente (acesso a levantamentos, mapa, dashboard). */
export function hasSupervisorTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_SUPERVISOR_EMAIL?.trim() &&
      process.env.TEST_SUPERVISOR_PASSWORD?.trim(),
  );
}

/** Usuário “cliente” (papel usuario) — só dashboard/mapa; opcional no E2E. */
export function hasClienteTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_CLIENTE_EMAIL?.trim() &&
      process.env.TEST_CLIENTE_PASSWORD?.trim(),
  );
}

export async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL?.trim();
  const password = process.env.TEST_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'E2E: configure TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD para loginAsAdmin()',
    );
  }
  await loginAs(page, email, password);
}

export async function loginAsOperador(page: Page) {
  const email = process.env.TEST_OPERADOR_EMAIL?.trim();
  const password = process.env.TEST_OPERADOR_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'E2E: configure TEST_OPERADOR_EMAIL e TEST_OPERADOR_PASSWORD para loginAsOperador()',
    );
  }
  await loginAs(page, email, password);
}

export async function loginAsNotificador(page: Page) {
  const email = process.env.TEST_NOTIF_EMAIL?.trim();
  const password = process.env.TEST_NOTIF_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'E2E: configure TEST_NOTIF_EMAIL e TEST_NOTIF_PASSWORD para loginAsNotificador()',
    );
  }
  await loginAs(page, email, password);
}

export async function loginAsSupervisor(page: Page) {
  const email = process.env.TEST_SUPERVISOR_EMAIL?.trim();
  const password = process.env.TEST_SUPERVISOR_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'E2E: configure TEST_SUPERVISOR_EMAIL e TEST_SUPERVISOR_PASSWORD para loginAsSupervisor()',
    );
  }
  await loginAs(page, email, password);
}

export async function loginAsCliente(page: Page) {
  const email = process.env.TEST_CLIENTE_EMAIL?.trim();
  const password = process.env.TEST_CLIENTE_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'E2E: configure TEST_CLIENTE_EMAIL e TEST_CLIENTE_PASSWORD para loginAsCliente()',
    );
  }
  await loginAs(page, email, password);
}

export function hasAgenteTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_AGENTE_EMAIL?.trim() &&
      process.env.TEST_AGENTE_PASSWORD?.trim(),
  );
}

export async function loginAsAgente(page: Page) {
  const email = process.env.TEST_AGENTE_EMAIL?.trim();
  const password = process.env.TEST_AGENTE_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error('E2E: configure TEST_AGENTE_EMAIL e TEST_AGENTE_PASSWORD');
  }
  await loginAs(page, email, password);
}
