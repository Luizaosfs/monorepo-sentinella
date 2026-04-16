import { test, expect } from '@playwright/test';
import {
  hasSupervisorTestCredentials,
  loginAsSupervisor,
  hasClienteTestCredentials,
  loginAsCliente,
} from './helpers/auth';

/**
 * Supervisor = gestor do município no Sentinela: dashboard, levantamentos e mapa de inspeção.
 * Credenciais: TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD (.env.e2e).
 */
test.describe('Supervisor — dashboard, levantamentos e mapa', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !hasSupervisorTestCredentials(),
      'Defina TEST_SUPERVISOR_EMAIL e TEST_SUPERVISOR_PASSWORD em .env.e2e',
    );
  });

  test('rotas principais carregam sem ir ao login', async ({ page }) => {
    await loginAsSupervisor(page);
    for (const path of ['/dashboard', '/levantamentos', '/mapa']) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});

/**
 * Usuário com papel "cliente" (usuario): só /dashboard e /mapa — /levantamentos exige admin/supervisor.
 * Opcional: TEST_CLIENTE_EMAIL / TEST_CLIENTE_PASSWORD.
 */
test.describe('Cliente (usuário) — dashboard e mapa', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !hasClienteTestCredentials(),
      'Defina TEST_CLIENTE_EMAIL e TEST_CLIENTE_PASSWORD para este teste',
    );
  });

  test('dashboard e mapa carregam sem ir ao login', async ({ page }) => {
    await loginAsCliente(page);
    for (const path of ['/dashboard', '/mapa']) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
