/**
 * Sentinella — Gerador de Manual do Usuário v2.1
 *
 * Uso:
 *   set -a && source .env.e2e && set +a
 *   node scripts/generate-manual-usuario.mjs
 *
 * Variáveis necessárias em .env.e2e:
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASS
 *   TEST_SUP_EMAIL   / TEST_SUP_PASS
 *   TEST_OP_EMAIL    / TEST_OP_PASS
 *   TEST_NOTIF_EMAIL / TEST_NOTIF_PASS
 *   TEST_CANAL_SLUG  / TEST_CANAL_BAIRRO
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { chromium } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'manual-screenshots');
const OUTPUT    = path.join(ROOT, 'manual_sentinella_v2.1.pdf');
const BASE_URL  = process.env.MANUAL_BASE_URL || 'http://localhost:4173';

const CREDS = {
  admin: { email: process.env.TEST_ADMIN_EMAIL,      pass: process.env.TEST_ADMIN_PASSWORD      },
  sup:   { email: process.env.TEST_SUPERVISOR_EMAIL, pass: process.env.TEST_SUPERVISOR_PASSWORD },
  op:    { email: process.env.TEST_OPERADOR_EMAIL,   pass: process.env.TEST_OPERADOR_PASSWORD   },
  notif: { email: process.env.TEST_NOTIF_EMAIL,      pass: process.env.TEST_NOTIF_PASSWORD      },
};
const CANAL_SLUG   = encodeURIComponent((process.env.TEST_CANAL_SLUG   || 'municipio-teste').trim());
const CANAL_BAIRRO = process.env.TEST_CANAL_BAIRRO_ID || '00000000-0000-0000-0000-000000000001';

// ── Paleta de cores (RGB) ─────────────────────────────────────────────────────
const C = {
  primary:      [13,  110, 86],
  primaryMid:   [29,  158, 117],
  primaryLight: [93,  202, 165],
  primaryXl:    [225, 245, 238],
  dark:         [15,  23,  42],
  mid:          [100, 116, 139],
  light:        [203, 213, 225],
  white:        [255, 255, 255],
  bg:           [248, 250, 252],
  info:         [59,  130, 246],
  success:      [34,  197, 94],
  warning:      [234, 179, 8],
  danger:       [239, 68,  68],
};

// ── Layout A4 ────────────────────────────────────────────────────────────────
const A4 = { w: 210, h: 297 };
const M  = { l: 15, r: 15, t: 30, b: 20 };
const CW = A4.w - M.l - M.r;

// ── Helpers de cor ────────────────────────────────────────────────────────────
function fill(doc, color) { doc.setFillColor(...color); }
function draw(doc, color) { doc.setDrawColor(...color); }
function rgb(doc, color)  { doc.setTextColor(...color); }

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function clickTab(page, name) {
  const sel = page
    .getByRole('tab', { name: new RegExp(name, 'i') })
    .or(page.getByRole('button', { name: new RegExp(name, 'i') }));
  if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sel.click();
    await page.waitForTimeout(400);
  }
}

async function loginAs(page, perfil) {
  const c = CREDS[perfil];
  if (!c?.email) { console.warn(`\n  [skip] sem credenciais para: ${perfil}`); return false; }

  // Verificar se já está logado (contexto compartilhado)
  const currentUrl = page.url();
  if (currentUrl && !currentUrl.includes('/login') && !currentUrl.includes('localhost') === false) {
    const alreadyLogged = await page.evaluate(() => !!localStorage.getItem('sb-ezrffpaialljfcqdmias-auth-token')).catch(() => false);
    if (alreadyLogged) return true;
  }

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  // Usar IDs específicos do formulário de login (não o de "esqueceu a senha")
  const emailInput = page.locator('#email');
  const passInput  = page.locator('#password');

  if (!await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn(`\n  [erro] campo #email não encontrado na tela de login`);
    return false;
  }

  await emailInput.fill(c.email);
  await passInput.fill(c.pass);

  // Clicar no botão submit do formulário de login (o que contém #password)
  await page.locator('form:has(#password) button[type="submit"]').click();

  // Aguardar saída do login
  await page.waitForURL(u => !u.pathname?.includes('/login') && !u.toString().includes('/login'), {
    timeout: 15000,
  }).catch(() => {});

  // Se caiu em /trocar-senha, ignorar e continuar
  const finalUrl = page.url();
  if (finalUrl.includes('/login')) {
    console.warn(`\n  [aviso] login pode ter falhado para ${perfil} — ainda em: ${finalUrl}`);
    return false;
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  return true;
}

async function shot(page, name, opts = {}) {
  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(opts.delay ?? 800);
  // Ocultar spinners e toasts dinâmicos
  await page.evaluate(() => {
    document.querySelectorAll('[data-sonner-toaster],.animate-spin,.animate-pulse')
      .forEach(el => { el.style.opacity = '0'; });
  }).catch(() => {});
  const fp = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  process.stdout.write('.');
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE FUNCTIONS — uma por seção
// ─────────────────────────────────────────────────────────────────────────────

async function capturePublico(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(`${BASE_URL}/`);                        await shot(p, 'c01-landing');
  await p.goto(`${BASE_URL}/login`);                   await shot(p, 'c02-login');
  await p.goto(`${BASE_URL}/install`).catch(() => {}); await shot(p, 'c02-install-pwa');
  await p.close();
}

async function captureDashboard(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/dashboard`);
  await shot(p, 'c04-dash-geral');
  await clickTab(p, 'levantamentos'); await shot(p, 'c04-dash-levantamentos');
  await clickTab(p, 'sla');           await shot(p, 'c04-dash-sla');
  await p.close();
}

async function captureLevantamentos(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/levantamentos`);
  await shot(p, 'c05-levantamentos-lista');
  const row = p.locator('table tbody tr').first();
  if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
    await row.click(); await p.waitForTimeout(600);
    await shot(p, 'c05-levantamentos-detalhe');
  }
  await p.close();
}

async function captureMapa(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/mapa`);
  await shot(p, 'c06-mapa-cluster', { delay: 2000 });
  const btn = p.getByRole('button', { name: /heatmap/i });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click(); await shot(p, 'c06-mapa-heatmap', { delay: 800 });
  }
  await p.close();
}

async function captureSla(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/admin/sla`);          await shot(p, 'c07-sla-gestao');
  await clickTab(p, 'config');                    await shot(p, 'c07-sla-config');
  await p.goto(`${BASE_URL}/admin/sla-feriados`); await shot(p, 'c07-sla-feriados');
  await p.close();
}

async function captureImoveis(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/admin/imoveis`);                 await shot(p, 'c08-imoveis');
  await p.goto(`${BASE_URL}/admin/imoveis-problematicos`);   await shot(p, 'c08-problematicos');
  await p.goto(`${BASE_URL}/admin/distribuicao-quarteirao`); await shot(p, 'c08-quarteirao');
  await p.close();
}

async function captureOperacoesHistorico(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/admin/operacoes`);             await shot(p, 'c09-operacoes');
  await p.goto(`${BASE_URL}/admin/historico-atendimento`); await shot(p, 'c09-historico');
  await clickTab(p, 'mapa');
  await shot(p, 'c09-historico-mapa', { delay: 1500 });
  await p.close();
}

async function captureSupervision(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/admin/supervisor-tempo-real`); await shot(p, 'c10-supervisor');
  await p.goto(`${BASE_URL}/admin/produtividade-agentes`); await shot(p, 'c10-produtividade');
  await p.close();
}

async function captureEpidemiologia(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'sup');
  await p.goto(`${BASE_URL}/admin/score-surto`);        await shot(p, 'c11-score-surto');
  await p.goto(`${BASE_URL}/admin/liraa`);              await shot(p, 'c12-liraa-iip');
  await clickTab(p, 'insumos');                         await shot(p, 'c12-liraa-insumos');
  await p.goto(`${BASE_URL}/admin/casos`);              await shot(p, 'c13-casos');
  await p.goto(`${BASE_URL}/admin/pluvio-risco`);       await shot(p, 'c14-pluvio-risco');
  await p.goto(`${BASE_URL}/admin/pluvio-operacional`); await shot(p, 'c14-pluvio-op');
  await p.goto(`${BASE_URL}/admin/mapa-comparativo`);   await shot(p, 'c15-mapa-comp', { delay: 2000 });
  await p.goto(`${BASE_URL}/admin/heatmap-temporal`);   await shot(p, 'c15-heatmap', { delay: 1500 });
  await p.close();
}

async function captureOperador(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await loginAs(p, 'op');
  await p.goto(`${BASE_URL}/operador/inicio`);  await shot(p, 'c16-op-inicio');
  await p.goto(`${BASE_URL}/operador/imoveis`); await shot(p, 'c17-op-imoveis');
  // Tentar abrir formulário de vistoria
  const card = p.locator('[class*="border-l-4"]').first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
    await card.click(); await p.waitForTimeout(500);
    await shot(p, 'c17-vistoria-etapa1');
    const prox = p.getByRole('button', { name: /próxima|avançar/i });
    if (await prox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prox.click(); await p.waitForTimeout(400); await shot(p, 'c17-vistoria-etapa2');
      await prox.click(); await p.waitForTimeout(400); await shot(p, 'c17-vistoria-etapa3');
    }
  }
  // Sem acesso
  await p.goto(`${BASE_URL}/operador/imoveis`);
  const semAcesso = p.getByRole('button', { name: /sem acesso/i }).first();
  if (await semAcesso.isVisible({ timeout: 3000 }).catch(() => false)) {
    await semAcesso.click(); await p.waitForTimeout(500);
    await shot(p, 'c18-sem-acesso');
  }
  await p.goto(`${BASE_URL}/operador/mapa`);         await shot(p, 'c19-op-mapa', { delay: 2000 });
  await p.goto(`${BASE_URL}/operador/levantamentos`); await shot(p, 'c19-op-itens');
  await p.close();
}

async function captureNotificador(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await loginAs(p, 'notif');
  await p.goto(`${BASE_URL}/notificador`);           await shot(p, 'c21-notif-home');
  await p.goto(`${BASE_URL}/notificador/registrar`); await shot(p, 'c21-notif-registrar');
  await p.close();
}

async function captureCanalCidadao(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE_URL}/denuncia/${CANAL_SLUG}/${CANAL_BAIRRO}`);
  await shot(p, 'c23-canal-form');
  await p.goto(`${BASE_URL}/denuncia/consultar`);
  await shot(p, 'c23-canal-consulta');
  await loginAs(p, 'sup');
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(`${BASE_URL}/admin/canal-cidadao`); await shot(p, 'c24-admin-canal');
  await p.close();
}

async function captureConfig(browser) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await loginAs(p, 'admin');
  const pages = [
    ['/admin/regioes',                'c25-regioes'],
    ['/admin/usuarios',               'c25-usuarios'],
    ['/admin/unidades-saude',         'c25-unidades'],
    ['/admin/plano-acao',             'c26-plano-acao'],
    ['/admin/risk-policy',            'c26-risk-policy'],
    ['/admin/painel-municipios',      'c27-municipios'],
    ['/admin/quotas',                 'c27-quotas'],
    ['/admin/yolo-qualidade',          'c27-yolo'],
    ['/admin/integracoes',            'c28-integracoes'],
  ];
  for (const [url, name] of pages) {
    await p.goto(`${BASE_URL}${url}`).catch(() => {});
    await shot(p, name);
  }
  await p.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function addCapa(doc) {
  fill(doc, C.dark); doc.rect(0, 0, A4.w, A4.h, 'F');
  // Faixa lateral
  fill(doc, C.primary); doc.rect(0, 0, 5, A4.h, 'F');
  // Círculos decorativos (radar)
  draw(doc, C.primaryMid); doc.setLineWidth(0.2);
  [55, 40, 26, 13].forEach((r, i) => {
    doc.setGState(doc.GState({ opacity: 0.06 + i * 0.04 }));
    doc.circle(105, 120, r, 'S');
  });
  doc.setGState(doc.GState({ opacity: 1 }));
  // Logotipo
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(38);
  rgb(doc, C.primaryMid);
  doc.setCharSpace(5);
  doc.text('SENTINELLA', 105, 108, { align: 'center' });
  doc.setCharSpace(0);
  // Linha decorativa
  draw(doc, C.primaryLight); doc.setLineWidth(0.5);
  doc.line(62, 114, 148, 114);
  // Subtítulo
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  rgb(doc, C.primaryLight);
  doc.setCharSpace(2.5);
  doc.text('INSPEÇÃO URBANA INTELIGENTE', 105, 121, { align: 'center' });
  doc.setCharSpace(0);
  // Badge
  fill(doc, C.primary);
  doc.setGState(doc.GState({ opacity: 0.45 }));
  doc.roundedRect(72, 204, 66, 9, 2, 2, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setFontSize(7); doc.setCharSpace(1.5); rgb(doc, C.primaryLight);
  doc.text('MANUAL DO USUÁRIO', 105, 210, { align: 'center' });
  doc.setCharSpace(0);
  // Título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); rgb(doc, C.white);
  doc.text('Guia Completo', M.l, 228);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(18); rgb(doc, C.primaryLight);
  doc.text('da Plataforma Sentinella', M.l, 238);
  // Versão
  doc.setFontSize(9); rgb(doc, C.mid);
  doc.text('Versão 2.1.0  ·  2026', M.l, 257);
  // Rodapé
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(9); rgb(doc, C.primaryMid);
  doc.text('SENTINELLA', A4.w - M.r, A4.h - 10, { align: 'right' });
}

function addIndice(doc, chapters) {
  doc.addPage();
  fill(doc, C.primaryXl); doc.rect(0, 0, A4.w, 26, 'F');
  fill(doc, C.primary);   doc.rect(0, 0, 5, 26, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); rgb(doc, C.primary);
  doc.text('Sumário', M.l + 3, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); rgb(doc, C.mid);
  doc.text('Sentinella — Manual do Usuário v2.1', A4.w - M.r, 16, { align: 'right' });

  const groups = [
    { label: 'Introdução',                   color: C.mid,       nums: [1, 2, 3] },
    { label: 'Painel do supervisor',          color: C.primary,   nums: [4,5,6,7,8,9,10] },
    { label: 'Análise epidemiológica',        color: C.info,      nums: [11,12,13,14,15] },
    { label: 'Agente de campo',               color: C.success,   nums: [16,17,18,19,20] },
    { label: 'Notificador de casos',          color: C.warning,   nums: [21,22] },
    { label: 'Canal público e cidadão',       color: [234,88,12], nums: [23,24] },
    { label: 'Configurações e administração', color: C.mid,       nums: [25,26,27,28] },
  ];
  const roleBg = {
    todos:       [[248,250,252], C.mid],
    supervisor:  [C.primaryXl,  C.primary],
    agente:      [[240,249,235], C.success],
    notificador: [[239,246,255], C.info],
    admin:       [C.primaryXl,  C.primary],
    público:     [[255,247,237], [234,88,12]],
  };

  let y = 36;
  for (const g of groups) {
    if (y > A4.h - 28) { doc.addPage(); y = 20; }
    draw(doc, g.color); doc.setLineWidth(0.25);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    rgb(doc, g.color); doc.setCharSpace(1);
    doc.text(g.label.toUpperCase(), M.l, y);
    doc.setCharSpace(0);
    const lw = doc.getTextWidth(g.label.toUpperCase()) + 3;
    doc.line(M.l + lw, y - 0.5, A4.w - M.r, y - 0.5);
    y += 5;

    for (const n of g.nums) {
      const ch = chapters.find(c => c.num === n);
      if (!ch) continue;
      if (y > A4.h - 18) { doc.addPage(); y = 18; }

      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); rgb(doc, C.primaryMid);
      doc.text(`${ch.num}`, M.l, y);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); rgb(doc, C.dark);
      doc.text(ch.title, M.l + 7, y);

      const [bg, txt] = roleBg[ch.role] ?? roleBg.todos;
      fill(doc, bg);
      doc.roundedRect(A4.w - M.r - 26, y - 3.5, 24, 5, 1, 1, 'F');
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); rgb(doc, txt);
      doc.text(ch.role, A4.w - M.r - 14, y, { align: 'center' });

      draw(doc, C.light); doc.setLineWidth(0.15);
      const end   = M.l + 7 + doc.getTextWidth(ch.title) + 2;
      const start = A4.w - M.r - 30;
      if (end < start) {
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.line(end, y - 0.5, start, y - 0.5);
        doc.setLineDashPattern([], 0);
      }

      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); rgb(doc, C.mid);
      doc.text(`${ch.page}`, A4.w - M.r, y, { align: 'right' });
      y += 6;
    }
    y += 3;
  }
}

function addChHeader(doc, ch) {
  fill(doc, C.primaryXl); doc.rect(0, 0, A4.w, 24, 'F');
  fill(doc, C.primary);   doc.rect(0, 0, 5, 24, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); rgb(doc, C.primaryMid);
  doc.text(`CAPÍTULO ${ch.num}  ·  ${ch.section.toUpperCase()}`, M.l + 3, 9);
  doc.setFontSize(13); rgb(doc, C.primary);
  doc.text(ch.title, M.l + 3, 18);
  return 30;
}

function addFooter(doc, pgNum) {
  draw(doc, C.primaryXl); doc.setLineWidth(0.4);
  doc.line(M.l, A4.h - 11, A4.w - M.r, A4.h - 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); rgb(doc, C.light);
  doc.text('Sentinella Map — Manual do Usuário', M.l, A4.h - 7);
  doc.text(`${pgNum}`, A4.w - M.r, A4.h - 7, { align: 'right' });
}

// Converte caracteres Unicode fora do WinAnsi para equivalentes ASCII
// (jsPDF helvetica nao suporta U+0100+ e gera lixo na linha inteira)
function sanitize(text) {
  if (typeof text !== 'string') return String(text ?? '');
  return text
    .replace(/\u2192/g, '->') // →
    .replace(/\u2190/g, '<-') // ←
    .replace(/\u2022/g, '-')  // •
    .replace(/\u22EE/g, '...') // ⋮
    .replace(/\u2026/g, '...') // …
    .replace(/\u2013/g, '-')  // –
    .replace(/\u2014/g, '--') // —
    .replace(/\u00B7/g, '.')  // ·
    .replace(/[\u201C\u201D]/g, '"') // "" curly double quotes
    .replace(/[\u2018\u2019]/g, "'") // '' curly single quotes
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // emojis bloco 1
    .replace(/[\u2600-\u27BF]/g, '')  // emojis/simbolos misc
    .replace(/[^\x00-\xFF]/g, '?');   // qualquer outro char fora do Latin-1
}

function para(doc, text, y, opts = {}) {
  const { size = 9, bold = false, color = C.dark, indent = 0 } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size); rgb(doc, color);
  const lines = doc.splitTextToSize(sanitize(text), CW - indent);
  doc.text(lines, M.l + indent, y);
  return y + lines.length * (size * 0.38) + 2;
}

function callout(doc, text, y, type = 'info') {
  const map = {
    info:    { bg: [239,246,255], bd: C.info,    tx: [30, 64,175] },
    tip:     { bg: [240,253,244], bd: C.success, tx: [6,  78, 59] },
    warning: { bg: [255,251,235], bd: C.warning, tx: [120,53, 15] },
    danger:  { bg: [254,242,242], bd: C.danger,  tx: [127,29, 29] },
  };
  const s = map[type] ?? map.info;
  const lines = doc.splitTextToSize(sanitize(text), CW - 10);
  const bh = lines.length * 3.8 + 7;
  if (y + bh > A4.h - M.b) { doc.addPage(); y = M.t; }
  fill(doc, s.bg); draw(doc, s.bd); doc.setLineWidth(0.35);
  doc.roundedRect(M.l, y, CW, bh, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); rgb(doc, s.tx);
  doc.text(lines, M.l + 5, y + 5);
  return y + bh + 4;
}

function bullets(doc, items, y) {
  for (const item of items) {
    if (y > A4.h - M.b - 6) { doc.addPage(); y = M.t; }
    fill(doc, C.primaryMid);
    doc.circle(M.l + 1.5, y - 1.5, 1, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); rgb(doc, C.dark);
    const lines = doc.splitTextToSize(sanitize(item), CW - 8);
    doc.text(lines, M.l + 5, y);
    y += lines.length * 3.5 + 3;
  }
  return y;
}

function steps(doc, items, y) {
  items.forEach((item, i) => {
    if (y > A4.h - M.b - 8) { doc.addPage(); y = M.t; }
    fill(doc, C.primary);
    doc.circle(M.l + 2.5, y - 1.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); rgb(doc, C.white);
    doc.text(`${i + 1}`, M.l + 2.5, y, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); rgb(doc, C.dark);
    const lines = doc.splitTextToSize(sanitize(item), CW - 9);
    doc.text(lines, M.l + 7, y);
    y += lines.length * 3.6 + 4;
  });
  return y;
}

function table(doc, headers, rows, y) {
  if (y + 30 > A4.h - M.b) { doc.addPage(); y = M.t; }
  autoTable(doc, {
    startY: y,
    head:   [headers],
    body:   rows,
    theme:  'striped',
    headStyles:         { fillColor: C.primary, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:         { fontSize: 8, textColor: C.dark },
    alternateRowStyles: { fillColor: C.bg },
    margin:             { left: M.l, right: M.r },
  });
  return doc.lastAutoTable.finalY + 6;
}

async function addShot(doc, name, y, caption, maxH = 80) {
  const fp = path.join(SHOTS_DIR, `${name}.png`);
  if (!existsSync(fp)) { console.warn(`    [sem screenshot: ${name}]`); return y + 4; }
  const buf    = readFileSync(fp);
  const base64 = buf.toString('base64');

  // Lê dimensões reais do PNG (IHDR chunk: bytes 16-19 = width, 20-23 = height)
  const pxW = buf.readUInt32BE(16);
  const pxH = buf.readUInt32BE(20);
  const ratio = pxH / pxW; // > 1 = portrait (mobile)

  let imgW, imgH, xOff;
  if (ratio > 1.2) {
    // Portrait (mobile): limita largura a 50% da coluna e centraliza
    const maxW = Math.min(CW * 0.50, 90);
    imgW = maxW;
    imgH = Math.min(maxH * 1.4, maxW * ratio);
    xOff = M.l + (CW - imgW) / 2;
  } else {
    // Landscape / quadrado: usa largura total
    imgW = CW;
    imgH = Math.min(maxH, imgW * ratio);
    xOff = M.l;
  }

  if (y + imgH + 10 > A4.h - M.b) { doc.addPage(); y = M.t; }
  draw(doc, C.light); doc.setLineWidth(0.2);
  doc.roundedRect(xOff, y, imgW, imgH, 2, 2, 'S');
  doc.addImage(`data:image/png;base64,${base64}`, 'PNG', xOff, y, imgW, imgH, '', 'FAST');
  y += imgH + 2;
  if (caption) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); rgb(doc, C.mid);
    doc.text(sanitize(caption), M.l, y + 3.5);
    y += 8;
  }
  return y + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPÍTULOS (28)
// ─────────────────────────────────────────────────────────────────────────────
const CHAPTERS = [
  // ── INTRODUÇÃO ─────────────────────────────────────────────────────────────
  {
    num: 1, title: 'O que é o Sentinella e o que ele faz', role: 'todos', page: 4,
    section: 'Introdução',
    intro: 'O Sentinella é uma plataforma SaaS para combate à dengue que combina levantamento por drone, vistoria manual de campo, análise por IA e gestão epidemiológica em um único sistema para prefeituras brasileiras.',
    shots: [{ name: 'c01-landing', cap: 'Tela inicial — visão geral da plataforma Sentinella' }],
    bullets: [
      'Levantamento por drone com análise automática de focos via YOLO e triagem por IA (Claude Haiku)',
      'Vistoria manual de campo seguindo padrão PNCD com depósitos A1–E',
      'Gestão de SLA operacional com escalamento automático, feriados e alertas push',
      'Cruzamento geoespacial entre focos detectados e casos notificados nas UBS',
      'Score preditivo de risco de surto por bairro (pluvio + recorrência + casos + SLA vencidos)',
      'Canal cidadão com foto, deduplicação geoespacial e acompanhamento por protocolo',
      'Relatório LIRAa nativo (IIP + IB) com exportação PDF conforme PNCD/MS',
      'Supervisão em tempo real — posição e produtividade dos agentes de campo',
      'Resumo diário gerado por IA (Claude Haiku) e enviado via push às 18h',
    ],
  },
  {
    num: 2, title: 'Acesso, login e instalação (PWA)', role: 'todos', page: 8,
    section: 'Introdução',
    intro: 'O Sentinella funciona no navegador e pode ser instalado como aplicativo (PWA) no celular. A instalação é recomendada para agentes de campo, pois habilita o modo offline com sincronização automática.',
    shots: [
      { name: 'c02-login',       cap: 'Tela de login — e-mail e senha' },
      { name: 'c02-install-pwa', cap: 'Instalação do PWA — disponível em iOS, Android e desktop' },
    ],
    steps: [
      'Acesse o endereço da plataforma no navegador do celular ou computador',
      'Insira o e-mail e a senha fornecidos pelo administrador municipal',
      'Clique em "Entrar" — você será redirecionado ao painel do seu perfil',
      'Para instalar: toque no banner "Instalar aplicativo" ou use o menu do navegador',
      'iOS: Safari → ícone de compartilhar → "Adicionar à Tela de Início"',
      'Android: Chrome → menu (⋮) → "Adicionar à tela inicial"',
    ],
    callouts: [
      { type: 'tip',  text: 'Instale o app como PWA para acessar offline e receber notificações push de SLA crítico e resumo diário.' },
      { type: 'info', text: 'Esqueceu a senha? Clique em "Esqueci minha senha" para receber o link de redefinição no e-mail cadastrado.' },
    ],
  },
  {
    num: 3, title: 'Perfis de usuário e permissões', role: 'todos', page: 12,
    section: 'Introdução',
    intro: 'O Sentinella possui 5 perfis de acesso. O perfil é atribuído pelo administrador no cadastro e determina quais telas e ações o usuário pode acessar.',
    tableHeaders: ['Perfil', 'Portal', 'Acesso principal', 'Restrições'],
    tableRows: [
      ['Administrador', 'Dashboard + Admin', 'Acesso total — inclui Clientes e Quotas', 'Nenhuma'],
      ['Supervisor',    'Dashboard + Admin', 'Tudo exceto Clientes, Quotas e Municípios', 'Não vê dados de outros clientes'],
      ['Agente (Operador)', '/operador',     'Imóveis, vistoria, mapa, meus itens', 'Apenas dados do próprio ciclo'],
      ['Notificador',   '/notificador',      'Registro e consulta de casos suspeitos', 'Sem mapas, relatórios ou SLA'],
      ['Usuário',       'Dashboard',         'Levantamentos e mapa (somente leitura)', 'Sem edição nem cadastros'],
    ],
    callouts: [
      { type: 'info', text: 'Ao logar como Agente, o usuário é redirecionado automaticamente para o portal /operador com interface otimizada para celular.' },
    ],
  },

  // ── PAINEL DO SUPERVISOR ───────────────────────────────────────────────────
  {
    num: 4, title: 'Dashboard — resumo diário e indicadores', role: 'supervisor', page: 16,
    section: 'Painel do supervisor',
    intro: 'Tela principal para supervisores e gestores. Organizada em 3 abas: Geral (alertas e situação do dia), Levantamentos (análise de focos e riscos) e SLA (prazos e operações em andamento).',
    shots: [
      { name: 'c04-dash-geral',         cap: 'Aba Geral — resumo IA, alertas de tempestade e risco pluviométrico' },
      { name: 'c04-dash-levantamentos', cap: 'Aba Levantamentos — gráficos de risco, prioridade e status de atendimento' },
      { name: 'c04-dash-sla',           cap: 'Aba SLA — score preditivo de surto e evolução de SLAs concluídos' },
    ],
    bullets: [
      'Resumo Diário (IA): sumário executivo gerado pelo Claude Haiku — botão "Gerar agora" disponível',
      'Alerta de Tempestade: previsão de precipitação e vento nos próximos 3 dias por região',
      'KPIs: levantamentos, itens identificados, alto risco, pendentes e SLA pendente',
      'Distribuição de Risco: gráfico de pizza com proporção por nível (crítico/alto/médio/baixo)',
      'Score Preditivo de Surto: top 3 bairros com maior risco nas próximas 2 semanas',
      'Evolução SLA: gráfico de linha com SLAs concluídos por dia nos últimos 7 dias',
    ],
  },
  {
    num: 5, title: 'Levantamentos — listagem e detalhes', role: 'supervisor', page: 24,
    section: 'Painel do supervisor',
    intro: 'Lista todos os levantamentos (drone e manual) com filtros por data, tipo e status. O painel de detalhes exibe foto, score, SLA, evidências e plano de ação de cada foco.',
    shots: [
      { name: 'c05-levantamentos-lista',   cap: 'Lista de levantamentos com filtros e exportação PDF' },
      { name: 'c05-levantamentos-detalhe', cap: 'Painel de detalhes — score, SLA, evidências e ações corretivas' },
    ],
    bullets: [
      'Filtros: por data, tipo de entrada (drone/manual) e status de atendimento',
      'Exportação: relatório PDF do levantamento com fotos dos focos identificados',
      'Detalhes: score de risco, prioridade, SLA restante, foto e localização do foco',
      'Plano de Ação: selecionar ação corretiva do catálogo (ex: "tampar caixa d\'água")',
      'Evidências: fotos registradas pelo agente de campo durante o atendimento',
      'Notificação e-SUS: botão para envio de notificação compulsória ao Ministério da Saúde',
      'Casos cruzados: focos vinculados automaticamente a casos notificados nas proximidades',
    ],
    callouts: [
      { type: 'tip', text: 'Use o filtro "Alto Risco" para priorizar atendimento. Itens com recorrência detectada aparecem com badge "Urgente".' },
    ],
  },
  {
    num: 6, title: 'Mapa de inspeção — cluster e heatmap', role: 'supervisor', page: 30,
    section: 'Painel do supervisor',
    intro: 'Exibe todos os focos georreferenciados no mapa. Dois modos: Cluster (agrupamento por proximidade) e Heatmap (mapa de calor). O painel lateral oferece filtros e estatísticas.',
    shots: [
      { name: 'c06-mapa-cluster', cap: 'Modo Cluster — agrupamento de focos por proximidade' },
      { name: 'c06-mapa-heatmap', cap: 'Modo Heatmap — mapa de calor com intensidade de ocorrências' },
    ],
    bullets: [
      'Cluster: círculos agrupam focos próximos — clique para expandir e ver detalhes',
      'Heatmap: camada de calor exibindo densidade de focos por área',
      'Filtros: por risco, status de atendimento e data no painel lateral',
      'Clique no marcador: exibe foto, endereço, score, SLA e ações rápidas',
      'Camadas: satélite, ruas (OpenStreetMap) e terreno',
    ],
    callouts: [
      { type: 'tip', text: 'Use o Heatmap para identificar quadrantes de alta concentração antes de planejar rotas. O Cluster é mais útil para inspecionar cada foco individualmente.' },
    ],
  },
  {
    num: 7, title: 'SLA Operacional — gestão e configuração', role: 'supervisor', page: 38,
    section: 'Painel do supervisor',
    intro: 'Controla os prazos de atendimento de cada foco. Todo item de levantamento gera um SLA automaticamente. Quatro abas: Gestão, Configuração, Regiões e Auditoria.',
    shots: [
      { name: 'c07-sla-gestao',   cap: 'Aba Gestão — indicadores, ranking de agentes e lista filtrada' },
      { name: 'c07-sla-config',   cap: 'Aba Configuração — prazo em horas por nível de prioridade' },
      { name: 'c07-sla-feriados', cap: 'Feriados SLA — calendário municipal de dias não úteis' },
    ],
    bullets: [
      'KPIs: Total, Sem Agente, Pendentes, Violados e Escalonados',
      'Status: Pendente (cinza), Em Atendimento (azul), Concluído (verde), Vencido (vermelho)',
      'Atribuição: selecione o agente responsável diretamente na tabela',
      'Escalamento automático: prioridade eleva progressivamente em SLAs não resolvidos',
      'Configuração: prazo em horas por prioridade — ex: Crítico 4h, Alto 12h, Médio 48h',
      'Feriados: datas cadastradas são descontadas do prazo; botão para importar feriados nacionais',
      'Horário comercial: SLA calculado apenas em dias úteis se configurado',
      'Auditoria: histórico de alterações de configuração com usuário e timestamp',
    ],
    callouts: [
      { type: 'warning', text: 'SLAs "Violados" indicam prazos ultrapassados. O sistema escala automaticamente, mas monitore diariamente para evitar acúmulo.' },
    ],
  },
  {
    num: 8, title: 'Imóveis — cadastro, problemáticos e distribuição de quarteirões', role: 'supervisor', page: 46,
    section: 'Painel do supervisor',
    intro: 'Três telas complementares: Imóveis (cadastro geral), Imóveis Problemáticos (histórico crítico de acesso) e Distribuição de Quarteirão (atribuição de território por agente e ciclo).',
    shots: [
      { name: 'c08-imoveis',       cap: 'Cadastro de imóveis — lista com busca e tipo de imóvel' },
      { name: 'c08-problematicos', cap: 'Imóveis Problemáticos — recusas, prioridade drone e notificação formal' },
      { name: 'c08-quarteirao',    cap: 'Distribuição de Quarteirões — atribuição de território por agente e ciclo' },
    ],
    bullets: [
      'Cadastro: logradouro, número, complemento, bairro, quarteirão e tipo',
      'Perfil de acesso: flags de proprietário ausente, animal agressivo, histórico de recusa, calha inacessível',
      'Histórico de ciclos: linha do tempo de visitas, focos e status por ciclo',
      'Notificação formal: PDF com protocolo numerado para imóveis com 3+ tentativas sem acesso',
      'Imóveis Problemáticos: alta taxa de sem-acesso, recusas e prioridade para drone',
      'Distribuição de Quarteirões: supervisor define qual agente cobre cada quarteirão por ciclo',
    ],
    callouts: [
      { type: 'info', text: 'A distribuição de quarteirões é opcional. Sem atribuição, o agente vê todos os imóveis do cliente.' },
    ],
  },
  {
    num: 9, title: 'Operações e histórico de atendimento', role: 'supervisor', page: 54,
    section: 'Painel do supervisor',
    intro: 'Operações registra ações de campo com rastreabilidade completa. O Histórico consolida ocorrências com métricas, filtros avançados e visualização em mapa.',
    shots: [
      { name: 'c09-operacoes',      cap: 'Gestão de Operações — status, agente responsável e vínculo com itens' },
      { name: 'c09-historico',      cap: 'Histórico de Atendimento — métricas e lista filtrada' },
      { name: 'c09-historico-mapa', cap: 'Histórico em mapa — ocorrências georreferenciadas com painel lateral' },
    ],
    bullets: [
      'Operações: vincule a itens de levantamento, bairros ou focos operacionais',
      'Status: Pendente → Em Andamento → Concluído / Cancelado',
      'KPIs do histórico: Total, Concluídos, Pendentes e Risco Alto',
      'Filtros: por risco, status e busca textual',
      'Aba Mapa: pontos georreferenciados com detalhes ao clicar',
    ],
  },
  {
    num: 10, title: 'Supervisão em tempo real e produtividade', role: 'supervisor', page: 60,
    section: 'Painel do supervisor',
    intro: 'Dois módulos para gestão da equipe: Supervisão em Tempo Real (posição e progresso de cada agente hoje) e Produtividade de Agentes (comparativo por ciclo).',
    shots: [
      { name: 'c10-supervisor',    cap: 'Supervisão em Tempo Real — progresso atualizado a cada minuto' },
      { name: 'c10-produtividade', cap: 'Produtividade de Agentes — comparativo por ciclo com exportação CSV' },
    ],
    bullets: [
      'Tempo Real: visitas hoje, último local visitado e tempo desde última atividade por agente',
      'Atualização automática a cada 60 segundos sem recarregar a página',
      'Badge de progresso: verde (≥ meta), amarelo (< meta), cinza (sem atividade hoje)',
      'Link "Ver no mapa": abre Google Maps na última coordenada de checkin do agente',
      'Produtividade: visitas totais, taxa de acesso (%), focos encontrados e média visitas/dia',
      'Exportação CSV para análise externa',
    ],
    callouts: [
      { type: 'info', text: 'A posição é baseada no último checkin da vistoria, não em GPS contínuo. Privacidade do agente preservada.' },
    ],
  },

  // ── ANÁLISE EPIDEMIOLÓGICA ─────────────────────────────────────────────────
  {
    num: 11, title: 'Score preditivo de surto por região', role: 'supervisor', page: 66,
    section: 'Análise epidemiológica',
    intro: 'Combina quatro fontes de dados para calcular o risco de surto nas próximas 2 semanas em cada região. Atualizado automaticamente a cada novo dado pluviométrico.',
    shots: [{ name: 'c11-score-surto', cap: 'Score Preditivo — tabela de regiões com barra de progresso colorida' }],
    tableHeaders: ['Componente', 'Peso', 'O que mede'],
    tableRows: [
      ['Risco pluviométrico', '30%', 'Probabilidade de proliferação baseada em chuva e previsão'],
      ['Focos recorrentes',   '30%', 'Endereços com foco reincidente nos últimos 30 dias'],
      ['Casos notificados 14d','25%','Casos suspeitos/confirmados na região'],
      ['SLAs vencidos',       '15%', 'Focos que excederam o prazo (risco acumulado)'],
    ],
    bullets: [
      'Escala 0–100: Baixo (0–29) · Moderado (30–59) · Alto (60–79) · Crítico (80+)',
      'Widget no Dashboard: top 3 bairros com maior score exibidos na aba SLA',
      'Tooltips em cada coluna explicando a contribuição do componente',
    ],
    callouts: [
      { type: 'warning', text: 'O score é um indicador de apoio à decisão — use em conjunto com o histórico de casos e dados de campo.' },
    ],
  },
  {
    num: 12, title: 'Relatório LIRAa — IIP e consumo de insumos', role: 'supervisor', page: 72,
    section: 'Análise epidemiológica',
    intro: 'Calcula automaticamente o IIP e o IB a partir das vistorias de campo. Duas abas: Índices (resultados por ciclo) e Insumos (consumo de larvicida por agente).',
    shots: [
      { name: 'c12-liraa-iip',     cap: 'Aba Índices — IIP, IB, semáforo de risco e tabela por tipo de depósito' },
      { name: 'c12-liraa-insumos', cap: 'Aba Insumos — consumo de larvicida em gramas e kg por agente' },
    ],
    tableHeaders: ['Índice', 'Fórmula', 'Classificação MS'],
    tableRows: [
      ['IIP — Infestação Predial', 'Imóveis c/ foco / Inspecionados × 100', '< 1% Satisfatório · 1–3,9% Alerta · ≥ 4% Risco'],
      ['IB — Índice de Breteau',   'Recipientes c/ foco / Inspecionados × 100', 'Complementar ao IIP'],
    ],
    bullets: [
      'Seletor de ciclo: 6 ciclos bimestrais (Janeiro–Dezembro)',
      'Semáforo visual: verde/amarelo/vermelho conforme nota técnica CGPNCD/MS',
      'Exportação PDF: relatório formal com cabeçalho e rodapé "conforme PNCD/MS"',
      'Aba Insumos: larvicida total em g e kg por agente — exportável em CSV',
    ],
    callouts: [
      { type: 'info', text: 'Dados LIRAa são baseados exclusivamente em vistorias com tipo de atividade "LIRAa". Certifique-se de que os agentes selecionam o tipo correto.' },
    ],
  },
  {
    num: 13, title: 'Casos notificados — triagem e cruzamento geoespacial', role: 'supervisor', page: 78,
    section: 'Análise epidemiológica',
    intro: 'Registra e gerencia casos suspeitos de dengue, chikungunya e zika. Os casos são cruzados automaticamente com focos de levantamento num raio configurável.',
    shots: [{ name: 'c13-casos', cap: 'Casos Notificados — agrupamento por bairro, filtros e atualização de status' }],
    bullets: [
      'Doenças: Dengue (laranja), Chikungunya (roxo), Zika (azul) e Suspeito (cinza)',
      'Status: Suspeito → Confirmado → Descartado — atualizável diretamente na tela',
      'Filtros: por período (7/30/90 dias), doença, status e unidade de saúde',
      'Cruzamento automático: cada caso vincula focos de levantamento a ≤ 500m e os eleva para "Crítico"',
      'LGPD: apenas logradouro e bairro armazenados — sem nome, CPF ou data de nascimento',
    ],
    callouts: [
      { type: 'warning', text: 'Um caso confirmado pode elevar vários focos simultaneamente. Revise o painel de SLA após confirmar casos.' },
    ],
  },
  {
    num: 14, title: 'Risco pluviométrico e tabela operacional', role: 'supervisor', page: 84,
    section: 'Análise epidemiológica',
    intro: 'Combina dados meteorológicos com o histórico de precipitação para classificar o risco de proliferação do Aedes por região. A Tabela Operacional traduz os riscos em prioridades de ação.',
    shots: [
      { name: 'c14-pluvio-risco', cap: 'Risco Pluviométrico — classificação por região com chuva e temperatura' },
      { name: 'c14-pluvio-op',    cap: 'Tabela Operacional — prioridades de ação por bairro' },
    ],
    bullets: [
      'Dados: chuva 24h/72h/7d, dias pós-chuva, persistência, tendência e previsão D+1/D+2/D+3',
      'Classificação: probabilidade de proliferação em faixa mínima e máxima por região',
      'Geração de SLAs: botão "Gerar SLAs a partir de run" cria SLAs para bairros de alto risco',
      'Atualização: job automático diário via API Open-Meteo — botão "Executar agora" disponível',
    ],
    callouts: [
      { type: 'info', text: 'A política de risco (pesos, bins e fatores) é personalizável pelo administrador em Cadastros → Políticas de Risco.' },
    ],
  },
  {
    num: 15, title: 'Análise comparativa e heatmap temporal', role: 'supervisor', page: 90,
    section: 'Análise epidemiológica',
    intro: 'Mapa Comparativo compara dois levantamentos lado a lado. Heatmap Temporal mostra a evolução semanal da densidade de focos ao longo do tempo.',
    shots: [
      { name: 'c15-mapa-comp', cap: 'Mapa Antes/Depois — dois levantamentos comparados lado a lado' },
      { name: 'c15-heatmap',   cap: 'Heatmap Temporal — animação da evolução semanal de focos' },
    ],
    bullets: [
      'Mapa Comparativo: selecione dois levantamentos A e B para comparar focos, riscos e status',
      'Estatísticas comparativas: total, resolvidos, pendentes e críticos de cada período',
      'Heatmap Temporal: filtre por risco e navegue pelas semanas epidemiológicas com Play/Pause',
      'Disponível apenas em desktop',
    ],
    callouts: [
      { type: 'tip', text: 'Use o Mapa Comparativo em reuniões com a prefeitura: selecione antes e depois de uma operação para mostrar a redução de focos.' },
    ],
  },

  // ── AGENTE DE CAMPO ────────────────────────────────────────────────────────
  {
    num: 16, title: 'Portal do agente — turno e atividades', role: 'agente', page: 96,
    section: 'Agente de campo',
    intro: 'Ao logar como agente, o usuário acessa o Portal do Agente — interface otimizada para celular. A tela de Início do Turno mostra o progresso do ciclo, a meta diária e os botões de atividade.',
    shots: [{ name: 'c16-op-inicio', cap: 'Início do Turno — progresso do ciclo, meta diária e tipos de atividade' }],
    bullets: [
      'KPIs do ciclo: Pendentes (vermelho), Visitados (verde), Cobertura % com barra de progresso',
      'Meta diária: "X de Y vistorias hoje" — calculada pelos dias úteis restantes no ciclo',
      'Banner offline: aviso quando há vistorias na fila aguardando conexão',
      'Tipos de atividade: Tratamento, Pesquisa, LIRAa, Ponto Estratégico — cada um abre lista de imóveis',
    ],
    callouts: [
      { type: 'tip', text: 'Instale o app como PWA antes de sair para campo. Os dados serão pré-carregados para acesso offline.' },
    ],
  },
  {
    num: 17, title: 'Formulário de vistoria — 5 etapas', role: 'agente', page: 102,
    section: 'Agente de campo',
    intro: 'O formulário de vistoria guia o agente pelo registro completo da visita. As etapas variam conforme o tipo de atividade selecionado no início do turno.',
    shots: [
      { name: 'c17-op-imoveis',      cap: 'Lista de imóveis — cards com status de visita e filtro por bairro' },
      { name: 'c17-vistoria-etapa1', cap: 'Etapa 1 — Responsável: moradores, grupos vulneráveis e checkin GPS' },
      { name: 'c17-vistoria-etapa2', cap: 'Etapa 2 — Sintomas: febre, manchas, articulações, dor de cabeça' },
      { name: 'c17-vistoria-etapa3', cap: 'Etapa 3 — Inspeção: depósitos A1/A2/B/C/D1/D2/E com entrada por voz' },
    ],
    tableHeaders: ['Etapa', 'Tratamento', 'Pesquisa', 'LIRAa', 'Ponto Estratégico'],
    tableRows: [
      ['1 — Responsável',   'Moradores',   'Moradores',   'Identificação', 'Checkin'],
      ['2 — Sintomas',      'Sintomas',    'Sintomas',    '—',             '—'],
      ['3 — Inspeção',      'Depósitos A1–E','Depósitos','Depósitos',     'Inspeção'],
      ['4 — Tratamento',    'Larvicida',   '—',           '—',             '—'],
      ['5 — Riscos/Obs.',   'Riscos',      'Riscos',      'Riscos',        'Observações'],
    ],
    bullets: [
      'Etapa 1: moradores, grávidas, idosos, crianças <7 anos, checkin GPS automático',
      'Etapa 2: sintomas (febre, manchas, articulações, cabeça) — ao confirmar, gera caso suspeito',
      'Etapa 3: 7 tipos de depósito PNCD (A1–E) — quantidades inspecionadas e com foco; entrada por voz',
      'Etapa 4: larvicida aplicado por tipo de depósito com quantidade em gramas',
      'Etapa 5: fatores de risco social (menor incapaz, risco alimentar, risco de moradia) e observação',
    ],
    callouts: [
      { type: 'tip', text: 'Use o botão de microfone nos campos numéricos da Etapa 3 para ditar valores: "dois", "três", "zero focos".' },
    ],
  },
  {
    num: 18, title: 'Registro sem acesso e revisita', role: 'agente', page: 110,
    section: 'Agente de campo',
    intro: 'Quando o agente não consegue acessar o imóvel, o formulário de Sem Acesso registra o motivo e sugere o melhor horário para revisita. Imóveis com 3+ tentativas ficam sinalizados para notificação formal.',
    shots: [{ name: 'c18-sem-acesso', cap: 'Formulário Sem Acesso — motivo, horário sugerido e foto da fachada' }],
    bullets: [
      'Motivos: Fechado/Ausente, Fechado/Viagem, Recusa de Entrada, Cachorro Bravo, Calha Inacessível, Outro',
      'Horário sugerido para revisita: Manhã, Tarde, Fim de Semana, Sem Previsão',
      'Foto da fachada: opcional — documenta a situação no momento da tentativa',
      'Status muda automaticamente para "Revisita" — destacado na lista de imóveis',
      'Imóveis com 3+ sem-acesso: sinalizados em Imóveis Problemáticos para notificação formal',
    ],
    callouts: [
      { type: 'warning', text: 'Recusas repetidas podem exigir notificação formal emitida pelo supervisor em Imóveis Problemáticos.' },
    ],
  },
  {
    num: 19, title: 'Mapa, rota otimizada e item manual', role: 'agente', page: 116,
    section: 'Agente de campo',
    intro: 'O Mapa do Agente exibe os focos atribuídos e oferece rota otimizada calculada pelo algoritmo do vizinho mais próximo. "Meus Itens" lista os focos de levantamento para atendimento.',
    shots: [
      { name: 'c19-op-mapa',  cap: 'Mapa do Agente — focos atribuídos com botão de rota otimizada' },
      { name: 'c19-op-itens', cap: 'Meus Itens — focos com checkin, ação aplicada e observação por voz' },
    ],
    bullets: [
      'Botão "Traçar rota": algoritmo vizinho mais próximo — abre rota no Google Maps com até 12 paradas',
      'Checkin: registra coordenada GPS de chegada — alimenta a supervisão em tempo real',
      'Ação aplicada: registre o que foi feito (ex: "Eliminou recipiente", "Tampou caixa d\'água")',
      'Observação por voz: microfone integrado para ditar a observação do atendimento',
      'Criar item manual: registre um foco descoberto em campo que não estava no levantamento',
    ],
    callouts: [
      { type: 'tip', text: 'Faça o checkin ao chegar ao imóvel antes de iniciar a vistoria. Isso registra sua posição para o supervisor.' },
    ],
  },
  {
    num: 20, title: 'Modo offline e sincronização automática', role: 'agente', page: 122,
    section: 'Agente de campo',
    intro: 'O Sentinella funciona sem internet. Ações offline são salvas no IndexedDB do dispositivo e sincronizadas automaticamente ao reconectar.',
    bullets: [
      'Operações suportadas offline: checkin de chegada, atualização de status e vistoria completa (todas as etapas)',
      'Banner offline: aviso amarelo exibindo "X vistoria(s) pendentes de envio"',
      'Fila automática: ao reconectar, operações são enviadas na ordem em que foram realizadas',
      'Sem perda de dados: cada vistoria é salva localmente antes de qualquer envio',
      'Sincronização transparente: ocorre em background sem nenhuma ação do agente',
    ],
    callouts: [
      { type: 'warning', text: 'O modo offline requer instalação como PWA. Usuários que acessam apenas pelo navegador podem perder dados em conexão instável.' },
    ],
  },

  // ── NOTIFICADOR ────────────────────────────────────────────────────────────
  {
    num: 21, title: 'Portal do notificador — registro de casos', role: 'notificador', page: 128,
    section: 'Notificador de casos',
    intro: 'Destinado a profissionais de saúde (UBS, UPA, hospitais) para registro de casos suspeitos. O painel exibe resumo dos últimos 30 dias com casos por doença e status.',
    shots: [
      { name: 'c21-notif-home',      cap: 'Início do Notificador — resumo de casos por doença (30 dias)' },
      { name: 'c21-notif-registrar', cap: 'Registrar Caso — formulário com doença, unidade, data e geolocalização' },
    ],
    bullets: [
      'Painel: Confirmados, Suspeitos e Descartados nos últimos 30 dias',
      'Formulário: doença, unidade de saúde (CNES), região e data de início dos sintomas',
      'Geocodificação: converte endereço em coordenadas automaticamente',
      'GPS: captura a posição atual do dispositivo com um toque',
      'Cruzamento automático ao salvar: focos de levantamento a ≤ 500m elevados para "Crítico"',
    ],
    callouts: [
      { type: 'warning', text: 'LGPD: armazene apenas logradouro e bairro. Nunca insira nome, CPF ou data de nascimento do paciente.' },
    ],
  },
  {
    num: 22, title: 'Integração e-SUS Notifica', role: 'notificador', page: 132,
    section: 'Notificador de casos',
    intro: 'Configuração e uso da integração com a API do e-SUS Notifica para envio de notificações compulsórias ao Ministério da Saúde.',
    shots: [{ name: 'c28-integracoes', cap: 'Tela de Integrações — configuração e-SUS com API key, IBGE e CNES' }],
    bullets: [
      'Configuração: API Key, URL do endpoint, código IBGE do município e CNES da unidade padrão',
      'Ambientes: Homologação (testes) e Produção (envio real ao MS)',
      'Botão "Testar conexão": valida as credenciais sem enviar notificação real',
      'CIDs suportados: A90 (Dengue), A92.0 (Chikungunya), A92.8 (Zika)',
      'Classificação padrão: "Suspeito" (código 2) — revise antes de enviar "Confirmado"',
      'Histórico de envios: auditoria com status e timestamp de cada notificação',
    ],
    callouts: [
      { type: 'warning', text: 'Configure em Homologação primeiro. Notificações em Produção são registradas permanentemente no sistema nacional do Ministério da Saúde.' },
    ],
  },

  // ── CANAL CIDADÃO ──────────────────────────────────────────────────────────
  {
    num: 23, title: 'Canal Cidadão — denúncia e acompanhamento', role: 'público', page: 136,
    section: 'Canal público e cidadão',
    intro: 'Página pública (sem login) acessada por QR code. Permite que qualquer morador registre um foco suspeito com descrição, foto e GPS. Após o envio, recebe um protocolo de acompanhamento.',
    shots: [
      { name: 'c23-canal-form',     cap: 'Formulário de denúncia — descrição, foto e GPS' },
      { name: 'c23-canal-consulta', cap: 'Consulta de protocolo — status atual da denúncia' },
    ],
    bullets: [
      'Campos: descrição (obrigatória), endereço aproximado (opcional), foto (opcional), GPS (opcional)',
      'Foto: câmera do celular ou galeria — máximo 10 MB',
      'Protocolo: código de 8 caracteres exibido após o envio (ex: A3F7C92B)',
      'Deduplicação: segunda denúncia no mesmo local (< 30m, < 24h) incrementa o contador de confirmações',
      'Rate limiting: máximo de 5 denúncias por coordenada em 30 minutos — protege contra spam',
      'Consulta: em /denuncia/consultar o cidadão verifica "Aguardando / Em atendimento / Resolvido"',
    ],
    callouts: [
      { type: 'info', text: 'Identidade preservada: o canal não exige cadastro nem coleta dados pessoais do denunciante.' },
    ],
  },
  {
    num: 24, title: 'Gestão do canal — QR codes e estatísticas', role: 'supervisor', page: 140,
    section: 'Canal público e cidadão',
    intro: 'Permite ao supervisor gerar QR codes por região e acompanhar todas as denúncias com foto, mapa e estatísticas consolidadas.',
    shots: [{ name: 'c24-admin-canal', cap: 'Admin Canal Cidadão — QR code por bairro, estatísticas e lista de denúncias' }],
    bullets: [
      'Gerador: selecione a região e clique em "Gerar QR Code" — imagem pronta para download e impressão',
      'KPIs: Total Recebidas, Aguardando e Resolvidas',
      'Lista de denúncias: protocolo, data, descrição, mapa e thumbnail da foto',
      'Confirmações: badge "X confirmações de moradores" em denúncias deduplicadas',
    ],
    callouts: [
      { type: 'tip', text: 'Afixe os QR codes em postos de saúde, escolas e mercados para aumentar o engajamento dos moradores.' },
    ],
  },

  // ── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
  {
    num: 25, title: 'Cadastros — regiões, usuários e unidades de saúde', role: 'admin', page: 144,
    section: 'Configurações e administração',
    intro: 'Agrupa as configurações estruturais: regiões geográficas, usuários e permissões, planejamentos de inspeção e unidades de saúde com sincronização CNES/DATASUS.',
    shots: [
      { name: 'c25-regioes',  cap: 'Regiões — cadastro com coordenadas e geocodificação automática' },
      { name: 'c25-usuarios', cap: 'Usuários — cadastro, perfil e redefinição de senha' },
      { name: 'c25-unidades', cap: 'Unidades de Saúde — cadastro manual ou sincronização CNES/DATASUS' },
    ],
    bullets: [
      'Regiões: nome e coordenadas (lat/lng) com geocodificação automática',
      'Usuários: nome, e-mail, perfil e senha inicial — botão para enviar link de redefinição',
      'Planejamentos: criação com data, área e tipo (drone/manual)',
      'Unidades de Saúde: manual ou sincronização CNES por código IBGE do município',
      'Sincronização CNES: importa UBS, UPA, hospitais e vigilâncias automaticamente do DATASUS',
    ],
    callouts: [
      { type: 'info', text: 'A sincronização CNES é recomendada para manter a lista de unidades atualizada com os dados oficiais do DATASUS.' },
    ],
  },
  {
    num: 26, title: 'Planos de ação, políticas de risco e feriados SLA', role: 'admin', page: 150,
    section: 'Configurações e administração',
    intro: 'Três módulos de parametrização: Catálogo de Planos de Ação (ações corretivas disponíveis), Políticas de Risco (modelo pluviométrico e YOLO) e Feriados SLA (calendário operacional).',
    shots: [
      { name: 'c26-plano-acao',  cap: 'Catálogo de Planos de Ação — ações padronizadas por tipo de foco' },
      { name: 'c26-risk-policy', cap: 'Políticas de Risco — parâmetros pluviométrico e drone/YOLO' },
    ],
    bullets: [
      'Planos de Ação: "Eliminar recipiente", "Tampar caixa d\'água", "Aplicar larvicida" — aparecem no atendimento',
      'Políticas Pluviométricas: bins de chuva, fatores de temperatura e vento, tendência e persistência',
      'Políticas YOLO: mapeamento de classes do modelo para nível de risco e sinônimos',
      'Feriados SLA: municipais e nacionais — botão para importar feriados nacionais automaticamente',
      'Horário comercial: ative para calcular SLA apenas em dias úteis',
    ],
  },
  {
    num: 27, title: 'Painel de municípios, quotas e qualidade da IA', role: 'admin', page: 156,
    section: 'Configurações e administração',
    intro: 'Três módulos exclusivos do administrador da plataforma: Painel de Municípios (visão consolidada), Quotas (limites de uso) e Qualidade do Drone (precisão do modelo IA).',
    shots: [
      { name: 'c27-municipios', cap: 'Painel de Municípios — comparativo de todos os clientes (7 dias)' },
      { name: 'c27-quotas',     cap: 'Quotas de Uso — limites configuráveis com barras de progresso' },
      { name: 'c27-yolo',       cap: 'Qualidade do Drone — precisão, evolução mensal e CSV de re-treino' },
    ],
    bullets: [
      'Painel de Municípios: focos, resolvidos, pendentes, críticos e taxa de resolução por cliente',
      'Exportação CSV: dados de todos os municípios para relatório consolidado estadual',
      'Quotas: limite de itens/mês e voos/mês com enforce automático via trigger no banco',
      'Qualidade do Drone: precisão estimada e taxa de falsos positivos',
      'CSV de re-treino: pares (imagem_url, confirmado_campo) para fine-tuning do modelo YOLO',
    ],
    callouts: [
      { type: 'info', text: 'Painel de Municípios e Quotas são visíveis apenas para o Administrador da plataforma.' },
    ],
  },
  {
    num: 28, title: 'Notificações push, resumo diário e integrações', role: 'admin', page: 162,
    section: 'Configurações e administração',
    intro: 'Módulos de comunicação automática: push notifications para SLA crítico e resumo diário gerado por IA; integração e-SUS Notifica para notificações compulsórias.',
    shots: [{ name: 'c28-integracoes', cap: 'Integrações — configuração e-SUS com auditoria de envios' }],
    bullets: [
      'Push SLA Crítico: notificação automática quando SLA vence em ≤ 1 hora para todos os dispositivos',
      'Resumo Diário: sumário IA às 18h com métricas do dia — enviado via push e salvo no histórico',
      'Histórico de resumos: últimos 30 resumos acessíveis no widget do Dashboard',
      'Botão "Gerar agora": solicita resumo imediato fora do horário automático',
      'Ativação: ao instalar o PWA e aceitar permissão, o dispositivo é cadastrado automaticamente',
    ],
    callouts: [
      { type: 'tip', text: 'Guie sua equipe na instalação do PWA e aceite de permissão de notificações para garantir que recebam os alertas de SLA crítico.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RENDER CHAPTER
// ─────────────────────────────────────────────────────────────────────────────

async function renderChapter(doc, ch, pg) {
  doc.addPage();
  pg.n++;
  ch.page = pg.n;

  let y = addChHeader(doc, ch);
  addFooter(doc, pg.n);

  if (ch.intro) {
    y = para(doc, ch.intro, y, { size: 9.5 });
    y += 4;
  }

  // Screenshots
  if (ch.shots) {
    for (const s of ch.shots) {
      if (y + 50 > A4.h - M.b) {
        doc.addPage(); pg.n++; addFooter(doc, pg.n); y = M.t;
      }
      y = await addShot(doc, s.name, y, s.cap, s.maxH);
      y += 2;
    }
  }

  // Bullets
  if (ch.bullets) {
    y += 2;
    if (y + 20 > A4.h - M.b) { doc.addPage(); pg.n++; addFooter(doc, pg.n); y = M.t; }
    y = bullets(doc, ch.bullets, y);
    y += 2;
  }

  // Steps
  if (ch.steps) {
    y += 2;
    if (y + 20 > A4.h - M.b) { doc.addPage(); pg.n++; addFooter(doc, pg.n); y = M.t; }
    y = steps(doc, ch.steps, y);
    y += 2;
  }

  // Table
  if (ch.tableHeaders) {
    y += 2;
    y = table(doc, ch.tableHeaders, ch.tableRows, y);
  }

  // Callouts
  if (ch.callouts) {
    y += 2;
    for (const c of ch.callouts) {
      y = callout(doc, c.text, y, c.type);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Sentinella — Gerador de Manual do Usuário v2.1\n');

  // 1. Build
  console.log('1/4  Fazendo build de preview...');
  try {
    execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' });
    console.log('     Build concluído.');
  } catch {
    console.warn('     [aviso] build falhou — usando servidor existente ou tentando dev server');
  }

  // 2. Preview server
  console.log('2/4  Iniciando servidor de preview...');
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--host'], {
    cwd: ROOT, stdio: 'pipe', shell: true,
  });
  srv.stderr.on('data', d => process.stdout.write(d.toString().replace(/^/gm, '     ')));
  await new Promise(r => setTimeout(r, 4000));

  // 3. Screenshots
  console.log('\n3/4  Capturando screenshots...\n');
  const browser = await chromium.launch({ headless: true });
  try {
    console.log('     [público]');      await capturePublico(browser);          console.log();
    console.log('     [dashboard]');    await captureDashboard(browser);        console.log();
    console.log('     [levantamentos]');await captureLevantamentos(browser);    console.log();
    console.log('     [mapa]');         await captureMapa(browser);             console.log();
    console.log('     [sla]');          await captureSla(browser);              console.log();
    console.log('     [imóveis]');      await captureImoveis(browser);          console.log();
    console.log('     [operações]');    await captureOperacoesHistorico(browser);console.log();
    console.log('     [supervisão]');   await captureSupervision(browser);      console.log();
    console.log('     [epidemiologia]');await captureEpidemiologia(browser);    console.log();
    console.log('     [operador]');     await captureOperador(browser);         console.log();
    console.log('     [notificador]');  await captureNotificador(browser);      console.log();
    console.log('     [canal cidadão]');await captureCanalCidadao(browser);     console.log();
    console.log('     [config]');       await captureConfig(browser);           console.log();
  } finally {
    await browser.close();
    srv.kill();
  }

  // 4. PDF
  console.log('\n4/4  Gerando PDF...\n');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pg  = { n: 0 };

  addCapa(doc);
  pg.n = 1;

  addIndice(doc, CHAPTERS);
  pg.n++;

  for (const ch of CHAPTERS) {
    process.stdout.write(`     Cap. ${String(ch.num).padStart(2)} — ${ch.title}...`);
    await renderChapter(doc, ch, pg);
    console.log(' ✓');
  }

  // Salvar em arquivo (Node.js — usa arraybuffer em vez de save())
  const pdfBytes = Buffer.from(doc.output('arraybuffer'));
  writeFileSync(OUTPUT, pdfBytes);

  const kb = Math.round(statSync(OUTPUT).size / 1024);
  console.log(`\n✅  PDF gerado com sucesso!`);
  console.log(`    Arquivo : ${OUTPUT}`);
  console.log(`    Páginas : ${pg.n}`);
  console.log(`    Tamanho : ${kb} KB\n`);
}

main().catch(e => { console.error('\n❌ Erro:', e.message || e); process.exit(1); });
