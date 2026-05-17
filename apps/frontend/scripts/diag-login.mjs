// Diagnóstico ground-truth do login no browser (e2e). NÃO é spec.
// Sobe chromium, vai ao /login do Vite :8080, loga como admin, e imprime
// a request /auth/login (URL/status/corpo), console, erros e URL final.
import { chromium } from '@playwright/test';

const APP = process.env.APP_URL ?? 'http://localhost:8080';
const EMAIL = process.env.D_EMAIL ?? 'luizantoniooliveira.digital@gmail.com';
const PASS = process.env.D_PASS ?? '123456';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const log = [];
page.on('console', (m) => log.push(`CONSOLE[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => log.push(`PAGEERROR ${e.message}`));
page.on('requestfailed', (r) => log.push(`REQFAIL ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', async (r) => {
  const u = r.url();
  if (/\/auth\/(login|me|refresh)/.test(u)) {
    let body = '';
    try { body = (await r.text()).slice(0, 200); } catch {}
    log.push(`RESP ${r.status()} ${u} :: ${body}`);
  }
});
page.on('request', (r) => {
  if (/\/auth\/(login|me)/.test(r.url())) log.push(`REQ ${r.method()} ${r.url()}`);
});

try {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  log.push(`URL após goto: ${page.url()}`);
  await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
  await page.getByRole('textbox', { name: /senha/i }).fill(PASS);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForTimeout(8000);
  log.push(`URL final: ${page.url()}`);
  log.push(`TITLE: ${await page.title()}`);
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300).replace(/\s+/g, ' ');
  log.push(`BODY: ${bodyText}`);
} catch (e) {
  log.push(`SCRIPT_ERR ${e.message}`);
} finally {
  console.log(log.join('\n'));
  await browser.close();
}
