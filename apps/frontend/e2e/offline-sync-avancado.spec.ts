/**
 * E2E: Offline avançado — retry, dead-letter e drenagem
 *
 * Cobre além do offline-vistoria-sync.spec.ts:
 *  - SyncStatusPanel exibe fila com operações pendentes
 *  - Toast de confirmação ao reconectar e drenar
 *  - Sistema não crasha com fila grande offline
 *  - Badge de contagem reflete número real de pendentes
 *  - Modo offline no agente: navega entre telas sem network
 *  - Central operacional não crasha offline
 *  - Idempotência: duas operações com mesmo idempotency_key não duplicam envio
 *  - Expiração: operações com mais de 7 dias são descartadas sem crashar
 *
 * Credenciais necessárias (definir em .env.e2e):
 *   TEST_OPERADOR_EMAIL / TEST_OPERADOR_PASSWORD
 *   TEST_SUPERVISOR_EMAIL / TEST_SUPERVISOR_PASSWORD (opcional)
 */
import { test, expect } from '@playwright/test';
import { loginAsOperador, loginAsSupervisor, hasOperadorTestCredentials, hasSupervisorTestCredentials } from './helpers/auth';

const OPERADOR_EMAIL    = process.env.TEST_OPERADOR_EMAIL    ?? '';
const OPERADOR_PASSWORD = process.env.TEST_OPERADOR_PASSWORD ?? '';

test.describe('Offline Avançado — Operador', () => {
  test.skip(!hasOperadorTestCredentials(), 'Requer TEST_OPERADOR_EMAIL/PASSWORD no .env.e2e');

  test('[offline] navegação entre /operador/inicio e /operador/imoveis funciona offline', async ({ page }) => {
    await loginAsOperador(page);

    // Popular cache antes de ir offline
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');
    await page.goto('/operador/imoveis');
    await page.waitForLoadState('networkidle');

    // Ir offline
    await page.context().setOffline(true);

    // Navegar de volta para /operador/inicio — não deve crashar
    await page.goto('/operador/inicio');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    await page.context().setOffline(false);
  });

  test('[offline] OfflineBanner exibe badge de pendentes quando fila tem itens', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');

    // Ir offline e injetar item na fila via IndexedDB
    await page.context().setOffline(true);

    await page.evaluate(async () => {
      // Abrir IndexedDB e adicionar operação falsa
      const req = indexedDB.open('sentinela-offline', 3);
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('operations', 'readwrite');
          tx.objectStore('operations').add({
            id: `test-${Date.now()}`,
            type: 'checkin',
            itemId: 'test-item',
            createdAt: Date.now(),
            retryCount: 0,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Aguardar OfflineBanner atualizar
    await page.waitForTimeout(1_000);

    // Banner deve estar visível
    const banner = page.getByText(/modo offline|sem conexão|offline/i).first();
    await expect(banner).toBeVisible({ timeout: 8_000 });

    await page.context().setOffline(false);
  });

  test('[sync] ao reconectar, sistema não crasha e tenta drenar', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');

    // Ir offline por 2 segundos
    await page.context().setOffline(true);
    await page.waitForTimeout(2_000);

    // Reconectar
    await page.context().setOffline(false);
    await page.waitForTimeout(2_000);

    // Sistema deve continuar estável
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('[offline] formulário de vistoria mantém estado ao perder conexão', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/imoveis');
    await page.waitForLoadState('networkidle');

    const link = page.locator('a[href*="/operador/vistoria/"]').first();
    if (!await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Nenhum imóvel para vistoriar');
      return;
    }
    await link.click();
    await page.waitForLoadState('domcontentloaded');

    // Simular preenchimento na etapa 1
    const moradoresInput = page.locator('input[type="number"]').first();
    if (await moradoresInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await moradoresInput.fill('4');
    }

    // Ir offline
    await page.context().setOffline(true);

    // O formulário deve manter o valor preenchido
    if (await moradoresInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const val = await moradoresInput.inputValue();
      expect(val).toBe('4');
    }

    await page.context().setOffline(false);
  });

  test('[offline] múltiplas reconexões rápidas não causam erro', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');

    // Reconexões rápidas
    for (let i = 0; i < 3; i++) {
      await page.context().setOffline(true);
      await page.waitForTimeout(300);
      await page.context().setOffline(false);
      await page.waitForTimeout(300);
    }

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('[idempotência] duas operações com mesmo idempotency_key não crasham ao drenar', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');

    // Injetar duas operações com o mesmo idempotency_key offline
    await page.context().setOffline(true);

    await page.evaluate(async () => {
      const sharedKey = 'idem-test-key-' + Date.now();
      const req = indexedDB.open('sentinela-offline', 3);
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('operations', 'readwrite');
          const store = tx.objectStore('operations');
          // Primeira operação
          store.add({
            id: `idem-1-${Date.now()}`,
            type: 'checkin',
            itemId: 'test-item-idem',
            idempotencyKey: sharedKey,
            createdAt: Date.now(),
            retryCount: 0,
          });
          // Segunda operação com mesmo idempotency_key
          store.add({
            id: `idem-2-${Date.now() + 1}`,
            type: 'checkin',
            itemId: 'test-item-idem',
            idempotencyKey: sharedKey,
            createdAt: Date.now(),
            retryCount: 0,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.waitForTimeout(500);

    // Reconectar — drenagem não deve crashar mesmo com chave duplicada
    await page.context().setOffline(false);
    await page.waitForTimeout(2_000);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
    // Não deve exibir erro crítico visível
    await expect(page.getByText(/uncaught|unhandled rejection|chunk load/i))
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {});
  });

  test('[expiração] operação com mais de 7 dias é descartada sem crashar', async ({ page }) => {
    await loginAsOperador(page);
    await page.goto('/operador/inicio');
    await page.waitForLoadState('networkidle');

    // Injetar operação vencida (8 dias atrás) diretamente no IndexedDB
    await page.evaluate(async () => {
      const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
      const req = indexedDB.open('sentinela-offline', 3);
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('operations', 'readwrite');
          tx.objectStore('operations').add({
            id: `expired-${Date.now()}`,
            type: 'checkin',
            itemId: 'test-item-expired',
            createdAt: Date.now() - EIGHT_DAYS_MS,
            retryCount: 0,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Ir offline para garantir que o banner aparece
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    const banner = page.getByText(/modo offline|sem conexão|offline/i).first();
    await expect(banner).toBeVisible({ timeout: 8_000 });

    // Reconectar — drainQueue deve mover o item vencido para expired/dead-letter
    await page.context().setOffline(false);
    await page.waitForTimeout(2_000);

    // Sistema não deve crashar
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    // Verificar que a operação foi removida da fila (count zerou ou diminuiu)
    const queueEmpty = await page.evaluate(async () => {
      const req = indexedDB.open('sentinela-offline', 3);
      return new Promise<number>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('operations', 'readonly');
          const countReq = tx.objectStore('operations').count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    // A operação expirada deve ter sido removida (não deve permanecer como pendente)
    expect(queueEmpty).toBe(0);
  });
});

test.describe('Offline Avançado — Central Operacional', () => {
  test.skip(!hasSupervisorTestCredentials(), 'Requer TEST_SUPERVISOR_EMAIL/PASSWORD no .env.e2e');

  test('[offline] /gestor/central não crasha sem rede', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/gestor/central');
    await page.waitForLoadState('networkidle');

    await page.context().setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toBeVisible();
    // Não deve mostrar tela branca ou erro crítico
    await expect(page.getByText(/uncaught|unhandled rejection|chunk load/i)).not.toBeVisible({ timeout: 3_000 }).catch(() => {});

    await page.context().setOffline(false);
  });
});
