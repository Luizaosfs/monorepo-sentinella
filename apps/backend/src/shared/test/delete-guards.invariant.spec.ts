import * as fs from 'fs';
import * as path from 'path';

/**
 * Invariante C.5: guards DELETE LGPD.
 *
 * Política do projeto: zero triggers no banco — toda regra fica em use-case/teste.
 * Este spec varre os repositórios Prisma procurando chamadas `.delete({` ou
 * `.deleteMany({` em clientes/imoveis/vistorias e falha o CI se alguém
 * introduzir hard delete nessas tabelas.
 *
 * Soft delete é o padrão: usar `softDelete(id, userId, clienteId)` nos
 * repositórios. Nunca `prisma.client.clientes.delete({ ... })`.
 */

const TABELAS_PROTEGIDAS = ['clientes', 'imoveis', 'vistorias'] as const;

// Pastas a varrer (somente TS de produção, não test/)
const PASTAS_ALVO = [
  path.resolve(__dirname, '../../../src/shared/modules/database/prisma'),
  path.resolve(__dirname, '../../../src/modules'),
];

function listarTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Pular pastas de teste
      if (e.name === 'test' || e.name === '__tests__') continue;
      out.push(...listarTs(full));
    } else if (
      e.isFile() &&
      e.name.endsWith('.ts') &&
      !e.name.endsWith('.spec.ts') &&
      !e.name.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('[C.5] Invariante — guards DELETE LGPD', () => {
  let arquivos: string[] = [];

  beforeAll(() => {
    arquivos = PASTAS_ALVO.flatMap(listarTs);
  });

  it.each(TABELAS_PROTEGIDAS)(
    'nenhum código de produção faz prisma.%s.delete* (use softDelete)',
    (tabela) => {
      // Regex match: .<tabela>.delete(  ou  .<tabela>.deleteMany(
      // Match direto ou via .client.<tabela>. — cobre os 2 estilos usados
      const padroes = [
        new RegExp(`\\.${tabela}\\.delete\\s*\\(`),
        new RegExp(`\\.${tabela}\\.deleteMany\\s*\\(`),
      ];

      const violacoes: string[] = [];

      for (const arquivo of arquivos) {
        const conteudo = fs.readFileSync(arquivo, 'utf8');
        const linhas = conteudo.split('\n');

        linhas.forEach((linha, i) => {
          for (const padrao of padroes) {
            if (padrao.test(linha)) {
              violacoes.push(
                `${path.relative(process.cwd(), arquivo)}:${i + 1}\n    ${linha.trim()}`,
              );
            }
          }
        });
      }

      if (violacoes.length > 0) {
        throw new Error(
          `[C.5] Hard delete detectado em ${tabela} (proibido por LGPD).\n` +
            `Use softDelete via Prisma extension. Violações:\n\n` +
            violacoes.join('\n\n'),
        );
      }
    },
  );

});
