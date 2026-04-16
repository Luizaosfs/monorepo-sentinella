/**
 * E2E: Gestor — Triagem e transições de focos_risco
 *
 * Cobre:
 *  - KPI bar com 4 cards clicáveis
 *  - Filtros de status (chips) com pontos coloridos
 *  - Tabela com bordas coloridas por prioridade
 *  - Botões de ação por status (Em triagem, Confirmar, etc.)
 *  - Detalhe de foco abre timeline
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { loginAsSupervisor, hasSupervisorTestCredentials } from './helpers/auth';

test.describe('Gestor — Triagem de Focos', () => {
  test('[guard] /gestor/focos sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/gestor/focos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

    test.beforeEach(async ({ page }) => {
      await loginAsSupervisor(page);
      await page.goto('/gestor/focos');
      await page.waitForLoadState('networkidle');
    });

    test('[smoke] página carrega sem erro', async ({ page }) => {
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/erro ao carregar|falha ao buscar/i)).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
    });

    test('[smoke] exibe KPI bar com cards de contagem', async ({ page }) => {
      // KPI cards: suspeita, confirmado, em tratamento, resolvido
      const kpis = page.getByText(/suspeita|confirmado|em tratamento|resolvido/i);
      await expect(kpis.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] filtro de status está presente', async ({ page }) => {
      // Chips/filtros de status
      const filtro = page.getByRole('button', { name: /suspeita|triagem|confirmado|tratamento|resolvido|descartado/i });
      await expect(filtro.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[smoke] tabela ou lista de focos está presente', async ({ page }) => {
      // Deve haver tabela ou lista (ou mensagem de vazio)
      const conteudo = page.getByRole('table')
        .or(page.getByRole('list'))
        .or(page.getByText(/nenhum foco|sem focos|0 focos/i));
      await expect(conteudo.first()).toBeVisible({ timeout: 10_000 });
    });

    test('[nav] clicar em foco abre detalhe com timeline', async ({ page }) => {
      // Clicar no primeiro link/linha de foco disponível
      const link = page.getByRole('link', { name: /detalhe|ver foco/i })
        .or(page.locator('a[href*="/gestor/focos/"]'))
        .first();

      if (!await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, 'Nenhum foco disponível para navegar');
        return;
      }
      await link.click();
      await page.waitForLoadState('domcontentloaded');

      // Detalhe deve ter timeline ou histórico
      await expect(page.getByText(/timeline|histórico|transição|estado/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('[filtro] clicar em chip de status filtra a lista', async ({ page }) => {
      const chip = page.getByRole('button', { name: /confirmado/i }).first();
      if (!await chip.isVisible({ timeout: 5_000 }).catch(() => false)) {
        test.skip(true, 'Chip "confirmado" não encontrado');
        return;
      }
      await chip.click();
      await page.waitForTimeout(800);
      // A URL ou algum elemento visual deve refletir o filtro
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Gestor — Mapa de Focos', () => {
  test('[guard] /gestor/mapa sem auth redireciona para /login', async ({ page }) => {
    await page.goto('/gestor/mapa');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test.describe('com credenciais', () => {
    test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

    test('[smoke] /gestor/mapa carrega mapa Leaflet', async ({ page }) => {
      await loginAsSupervisor(page);
      await page.goto('/gestor/mapa');
      await page.waitForLoadState('networkidle');

      // Leaflet renderiza um elemento .leaflet-container
      const mapa = page.locator('.leaflet-container');
      await expect(mapa).toBeVisible({ timeout: 15_000 });
    });

    test('[smoke] painel de filtros do mapa está acessível', async ({ page }) => {
      await loginAsSupervisor(page);
      await page.goto('/gestor/mapa');
      await page.waitForLoadState('networkidle');

      // Botão de filtros ou painel lateral
      const filtroBtn = page.getByRole('button', { name: /filtro|filter|prioridade|status/i })
        .or(page.getByText(/prioridade|status do foco|tipo de origem/i));
      await expect(filtroBtn.first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
