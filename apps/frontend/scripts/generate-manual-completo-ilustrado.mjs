import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const USER_GUIDE_DIR = path.join(ROOT, "docs/user-guide");
const IMAGES_DIR = path.join(USER_GUIDE_DIR, "images");

const OUT_MD = path.join(USER_GUIDE_DIR, "manual-completo-ilustrado.md");
const OUT_PDF = path.join(USER_GUIDE_DIR, "manual-completo-ilustrado.pdf");
const SCREENSHOT_PLAN_PATH = path.join(USER_GUIDE_DIR, "screenshots-pendentes.md");

const CHAPTERS = [
  "README.md",
  "01-visao-geral.md",
  "02-primeiro-acesso-e-login.md",
  "03-dashboard.md",
  "04-planejamento.md",
  "05-levantamento-manual.md",
  "06-levantamento-drone.md",
  "07-analise-e-classificacao-de-riscos.md",
  "08-mapa-inteligente.md",
  "09-relatorios.md",
  "10-cadastros-e-administracao.md",
  "11-filtros-buscas-e-listagens.md",
  "12-configuracoes-e-parametros.md",
  "13-boas-praticas-operacionais.md",
  "14-solucao-de-problemas.md",
  "faq.md",
  "mapa-de-telas.md",
  // Nota: `screenshots-pendentes.md` é uma tabela longa (roteiro operacional de captura).
  // Em PDF, tabelas muito longas podem causar páginas “em branco” em alguns visualizadores.
  // Mantemos como anexo referenciado (fora do fluxo consolidado).
];

function readChapter(file) {
  const p = path.join(USER_GUIDE_DIR, file);
  if (!fs.existsSync(p)) return `\n\n> Capítulo não encontrado: ${file}\n\n`;
  return fs.readFileSync(p, "utf-8");
}

function listImages() {
  if (!fs.existsSync(IMAGES_DIR)) return [];
  return fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function parseScreenshotPlan(markdown) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    if (line.includes("| Ordem |")) continue;
    if (line.includes("|------")) continue;

    const cols = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cols.length < 8) continue;

    const [ordemRaw, modulo, tela, rota, arquivoRaw, tipo, oQue, observacoes] = cols;
    const ordem = Number(ordemRaw);
    if (!Number.isFinite(ordem)) continue;

    const arquivo = arquivoRaw.replace(/`/g, "");
    const rotaClean = rota.replace(/`/g, "");

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

function chapterToModules(chapterFile) {
  // Mapeamento pragmático para distribuir as imagens “na sequência do manual”.
  // A fonte de verdade para os prints é o screenshots-pendentes.md (ordem já roteirizada).
  switch (chapterFile) {
    case "README.md":
      return ["Público", "Acesso", "Navegação"];
    case "01-visao-geral.md":
      return ["Dashboard"];
    case "02-primeiro-acesso-e-login.md":
      return ["Acesso"];
    case "03-dashboard.md":
      return ["Dashboard"];
    case "04-planejamento.md":
      return ["Administração — Planejamento"];
    case "05-levantamento-manual.md":
      return ["Operador (Campo)", "Operador (Mapa)", "Operador (Itens)"];
    case "06-levantamento-drone.md":
      return ["Levantamentos"];
    case "07-analise-e-classificacao-de-riscos.md":
      return ["Administração — Risco & Pluvio", "Administração — Políticas"];
    case "08-mapa-inteligente.md":
      return ["Mapa"];
    case "09-relatorios.md":
      return ["Levantamentos", "Administração — SLA"];
    case "10-cadastros-e-administracao.md":
      return [
        "Administração — Clientes",
        "Administração — Usuários",
        "Administração — Usuários (Cliente)",
        "Administração — Regiões",
        "Administração — Quotas",
        "Administração — Drones",
        "Administração — Voos",
        "Administração — Operações",
        "Administração — Canal Cidadão",
        "Administração — Casos",
        "Administração — Imóveis",
        "Administração — Mapas",
        "Administração — Painéis",
        "Administração — Auditoria",
      ];
    case "11-filtros-buscas-e-listagens.md":
      return ["Levantamentos", "Mapa", "Operador", "Administração — SLA"];
    case "12-configuracoes-e-parametros.md":
      return ["Administração — Políticas", "Administração — Quotas"];
    case "13-boas-praticas-operacionais.md":
      return ["Dashboard", "Mapa", "Levantamentos", "Operador (Campo)", "Administração — SLA"];
    case "14-solucao-de-problemas.md":
      return ["Acesso", "Erros"];
    case "faq.md":
      return ["Acesso", "Operador", "Administração — SLA"];
    case "mapa-de-telas.md":
      return ["Navegação"];
    default:
      return [];
  }
}

function pickReplacementImageForChapter(chapterFile, byModule) {
  const modules = chapterToModules(chapterFile);
  for (const m of modules) {
    const rows = byModule.get(m) ?? [];
    if (rows.length) return rows[0].arquivo;
  }
  return null;
}

function rewriteBrokenImageRefs({ chapterFile, content, existing, byModule, pending }) {
  // Substitui referências quebradas do tipo ![alt](./images/foo.png)
  // por um print real do módulo (quando possível). Caso contrário, avisa e registra pendência.
  const IMG_RE = /!\[([^\]]*)\]\((\.\/images\/([^)]+?\.png))\)/g;

  return content.replaceAll(IMG_RE, (full, alt, rel, file) => {
    if (existing.has(file)) return full;

    const replacement = pickReplacementImageForChapter(chapterFile, byModule);
    if (replacement && existing.has(replacement)) {
      pending.replaced.push({ chapterFile, missing: file, replacement });
      return `![${alt || replacement}](./images/${replacement})\n\n> Screenshot original não localizado: \`${file}\`. Substituído por: \`${replacement}\`.`;
    }

    pending.missing.push({ chapterFile, missing: file });
    return `> Screenshot não disponível no momento: \`${file}\`. (Pendente de captura)`;
  });
}

const images = listImages();
const now = new Date().toLocaleString("pt-BR");
const planMarkdown = fs.existsSync(SCREENSHOT_PLAN_PATH) ? fs.readFileSync(SCREENSHOT_PLAN_PATH, "utf-8") : "";
const planRows = planMarkdown ? parseScreenshotPlan(planMarkdown) : [];
const existing = new Set(images);

const planRowsExisting = planRows.filter((r) => existing.has(r.arquivo));
const byModule = new Map();
for (const r of planRowsExisting) {
  if (!byModule.has(r.modulo)) byModule.set(r.modulo, []);
  byModule.get(r.modulo).push(r);
}

const used = new Set();
const pending = { missing: [], replaced: [] };
let imgRefsTotal = 0;
let imgRefsBroken = 0;

let md = "";
md += "# Manual completo ilustrado — Sentinella\n\n";
md += `> Gerado automaticamente em **${now}**.\n\n`;
md += "## Como usar este PDF\n\n";
md += "- Este documento consolida os capítulos do guia do usuário em uma leitura contínua.\n";
md += "- As imagens são inseridas **ao longo do manual**, por capítulo/módulo.\n";
md += "- Algumas telas (ex.: Vistoria e Denúncia pública) dependem de rotas dinâmicas e podem não estar disponíveis.\n\n";

md += "## Conteúdo consolidado\n\n";
for (const ch of CHAPTERS) {
  let content = readChapter(ch);
  // Contabiliza refs de imagens antes de reescrever.
  const refs = [...content.matchAll(/!\[[^\]]*\]\(\.\/images\/([^)]+?\.png)\)/g)].map((m) => m[1]);
  imgRefsTotal += refs.length;
  for (const f of refs) if (!existing.has(f)) imgRefsBroken += 1;

  // Substitui refs quebradas e adiciona avisos.
  content = rewriteBrokenImageRefs({ chapterFile: ch, content, existing, byModule, pending });

  // Evita múltiplos H1 ao concatenar (converte "# " do começo de arquivo em "## ")
  content = content.replace(/^#\s+/m, "## ");
  md += `\n\n---\n\n<!-- ${ch} -->\n\n`;
  md += content.trimEnd() + "\n";

  const modules = chapterToModules(ch);
  const rowsForChapter = [];
  for (const m of modules) {
    const rows = byModule.get(m) ?? [];
    for (const r of rows) rowsForChapter.push(r);
  }

  if (rowsForChapter.length) {
    md += "\n\n### Capturas de tela (referência visual)\n\n";
    md += "A seguir, capturas relacionadas a este capítulo/módulo.\n\n";

    for (const r of rowsForChapter) {
      if (used.has(r.arquivo)) continue;
      used.add(r.arquivo);
      md += `#### ${r.tela}\n\n`;
      if (r.rota && r.rota !== "qualquer" && !r.rota.includes("qualquer rota inexistente")) {
        md += `Rota: \`${r.rota}\`\n\n`;
      }
      md += `![${r.arquivo}](./images/${r.arquivo})\n\n`;
    }
  }
}

md += "\n\n---\n\n";
md += "## Anexos\n\n";
md += "### Anexo A — Roteiro de screenshots (captura de telas)\n\n";
md += "O roteiro completo de capturas (tabela detalhada por módulo, rota e objetivo) está em:\n\n";
md += "- `docs/user-guide/screenshots-pendentes.md`\n\n";
md += "Observação: por ser uma tabela longa, ela é mantida fora deste PDF ilustrado para evitar falhas de renderização em alguns leitores de PDF.\n\n";

// Apêndice apenas para imagens que existam mas não foram encaixadas por capítulo.
const remaining = images.filter((f) => !used.has(f));
if (remaining.length) {
  md += "\n\n---\n\n";
  md += "## Apêndice — Capturas não referenciadas nos capítulos\n\n";
  md += `Imagens restantes: **${remaining.length}**\n\n`;
  for (const file of remaining) {
    md += `### ${file.replace(/\.png$/i, "")}\n\n`;
    md += `![${file}](./images/${file})\n\n`;
  }
}

if (pending.missing.length || pending.replaced.length) {
  md += "\n\n---\n\n";
  md += "## Pendências e substituições de screenshots\n\n";
  md += `- Referências de imagem no texto (total): **${imgRefsTotal}**\n`;
  md += `- Referências quebradas detectadas: **${imgRefsBroken}**\n`;
  md += `- Substituições automáticas realizadas: **${pending.replaced.length}**\n`;
  md += `- Pendências sem substituto: **${pending.missing.length}**\n\n`;

  if (pending.replaced.length) {
    md += "### Substituições realizadas\n\n";
    for (const r of pending.replaced) {
      md += `- **${r.chapterFile}**: \`${r.missing}\` → \`${r.replacement}\`\n`;
    }
    md += "\n";
  }

  if (pending.missing.length) {
    md += "### Pendências (prints não localizados)\n\n";
    for (const r of pending.missing) {
      md += `- **${r.chapterFile}**: \`${r.missing}\`\n`;
    }
    md += "\n";
  }
}

fs.writeFileSync(OUT_MD, md, "utf-8");

console.log("Arquivo gerado:");
console.log(`- ${path.relative(ROOT, OUT_MD)}`);
console.log("Agora gere o PDF com:");
console.log("  npm run docs:user-guide:pdf-ilustrado");
console.log("Saída esperada:");
console.log(`- ${path.relative(ROOT, OUT_PDF)}`);

