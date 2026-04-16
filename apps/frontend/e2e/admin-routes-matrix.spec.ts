import { test, expect } from '@playwright/test';
import { hasAdminTestCredentials, loginAsAdmin } from './helpers/auth';

/** Rotas filhas de `/admin` (App.tsx) — smoke sem redirecionar ao login. */
const ADMIN_PATHS = [
  '/admin/dashboard',
  '/admin/clientes',
  '/admin/usuarios',
  '/admin/planejamentos',
  '/admin/drones',
  '/admin/regioes',
  '/admin/pluvio-risco',
  '/admin/risk-policy',
  '/admin/pluvio-operacional',
  '/admin/sla',
  '/admin/operacoes',
  '/admin/historico-atendimento',
  '/admin/voos',
  '/admin/quotas',
  '/admin/mapa-comparativo',
  '/admin/heatmap-temporal',
  '/admin/painel-municipios',
  '/admin/canal-cidadao',
  '/admin/casos',
  '/admin/imoveis',
  '/admin/imoveis-problematicos',
  '/admin/unidades-saude',
  '/admin/plano-acao',
  '/admin/sla-feriados',
  '/admin/integracoes',
  '/admin/liraa',
  '/admin/produtividade-agentes',
  '/admin/score-surto',
  '/admin/yolo-qualidade',
  '/admin/distribuicao-quarteirao',
  '/admin/supervisor-tempo-real',
  '/admin/saude-sistema',
  '/admin/job-queue',
  '/admin/pipeline-status',
  '/admin/eficacia-tratamentos',
  '/admin/score-config',
  '/admin/executivo',
  '/admin/ciclos',
  '/admin/reincidencia',
];

const GESTOR_PATHS = [
  '/gestor/central',
  '/gestor/triagem',
  '/gestor/focos',
  '/gestor/mapa',
];

test.describe('Matriz de rotas admin + gestor', () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(
      !hasAdminTestCredentials(),
      'Defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD em .env.e2e',
    );
  });

  test('cada rota /admin/* carrega sem ir ao login', async ({ page }) => {
    await loginAsAdmin(page);
    for (const path of ADMIN_PATHS) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test('rotas /gestor/* carregam sem ir ao login', async ({ page }) => {
    await loginAsAdmin(page);
    for (const path of GESTOR_PATHS) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  test('detalhe de foco (UUID placeholder) não redireciona ao login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/gestor/focos/00000000-0000-0000-0000-000000000001');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin/supervisor acessa gestão de usuários da área operador', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/operador/usuarios');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
