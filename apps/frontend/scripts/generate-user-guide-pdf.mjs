import path from "node:path";
import fs from "node:fs";
import { mdToPdf } from "md-to-pdf";

const ROOT = process.cwd();
const INPUTS = [
  {
    in: path.join(ROOT, "docs/user-guide/manual-completo.md"),
    out: path.join(ROOT, "docs/user-guide/manual-completo.pdf"),
  },
  {
    in: path.join(ROOT, "docs/user-guide/manual-prefeitura.md"),
    out: path.join(ROOT, "docs/user-guide/manual-prefeitura.pdf"),
  },
  {
    in: path.join(ROOT, "docs/user-guide/manual-completo-ilustrado.md"),
    out: path.join(ROOT, "docs/user-guide/manual-completo-ilustrado.pdf"),
  },
];

for (const { in: inPath, out: outPath } of INPUTS) {
  if (!fs.existsSync(inPath)) {
    throw new Error(`Arquivo não encontrado: ${inPath}`);
  }
  const res = await mdToPdf(
    { path: inPath },
    {
      dest: outPath,
      // Deixa links relativos do manual (./images/...) apontando para o diretório do manual.
      // Para usar imagens reais no PDF, basta existir o arquivo em docs/user-guide/images/.
      basedir: path.dirname(inPath),
      pdf_options: {
        format: "A4",
        printBackground: true,
        margin: {
          top: "14mm",
          right: "14mm",
          bottom: "14mm",
          left: "14mm",
        },
      },
    }
  );

  if (!res?.filename) {
    throw new Error(`Falha ao gerar PDF: ${outPath}`);
  }
}

console.log("PDFs gerados em docs/user-guide/:");
for (const { out } of INPUTS) console.log(`- ${path.relative(ROOT, out)}`);

