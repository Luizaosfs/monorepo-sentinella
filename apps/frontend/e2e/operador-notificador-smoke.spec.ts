import { test, expect } from '@playwright/test';
import {
  hasOperadorTestCredentials,
  hasNotificadorTestCredentials,
  loginAsOperador,
  loginAsNotificador,
} from './helpers/auth';

const imovelId =
  process.env.E2E_IMOVEL_ID?.trim() || '00000000-0000-0000-0000-000000000001';

/** Rotas OperadorGuard (sem `/operador/usuarios` — exige AdminOrSupervisor). */
const OPERADOR_PATHS = [
  '/operador',
  '/operador/levantamentos',
  '/operador/levantamentos/novo-item',
  '/operador/mapa',
  '/operador/inicio',
  '/operador/imoveis',
  `/operador/vistoria/${imovelId}`,
  '/operador/rota',
  '/agente/hoje',
  `/agente/vistoria/${imovelId}`,
];

const NOTIFICADOR_PATHS = ['/notificador', '/notificador/registrar'];

test.describe('Operador — área de campo', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !hasOperadorTestCredentials(),
      'Defina TEST_OPERADOR_EMAIL e TEST_OPERADOR_PASSWORD em .env.e2e',
    );
  });

  test('rotas /operador/* e /agente/* carregam sem ir ao login', async ({ page }) => {
    await loginAsOperador(page);
    for (const path of OPERADOR_PATHS) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});

test.describe('Notificador — casos em unidade de saúde', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !hasNotificadorTestCredentials(),
      'Defina TEST_NOTIF_EMAIL e TEST_NOTIF_PASSWORD em .env.e2e',
    );
  });

  test('home e registro de caso carregam sem ir ao login', async ({ page }) => {
    await loginAsNotificador(page);
    for (const path of NOTIFICADOR_PATHS) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
