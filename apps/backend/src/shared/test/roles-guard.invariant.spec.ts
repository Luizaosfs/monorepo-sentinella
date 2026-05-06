import * as fs from 'fs';
import * as path from 'path';

/**
 * Invariante: endpoints operacionais devem ter @Roles() ou @Public().
 *
 * Garante que nenhum handler HTTP em módulos operacionais seja acessível
 * apenas com AuthGuard (sem segregação por papel).
 *
 * Padrão: igual ao invariante C.5 (delete-guards.invariant.spec.ts).
 * Para adicionar um módulo: incluir o nome em MODULOS_OPERACIONAIS.
 * Para exceções legítimas: adicionar @Public() no handler.
 */

const MODULOS_OPERACIONAIS = [
  'foco-risco',
  'vistoria',
  'imovel',
  'levantamento',
  'operacao',
  'sla',
  'notificacao',
] as const;

const MODULES_DIR = path.resolve(__dirname, '../../../src/modules');

// Decorator de método HTTP (início de handler)
const RE_HTTP_METHOD = /^\s*@(Get|Post|Put|Patch|Delete)\s*\(/;

// Guard válido: @Roles(...) ou @Public()
const RE_GUARD = /^\s*@(Roles|Public)\s*\(/;

function listarControllers(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith('.controller.ts') &&
        !e.name.endsWith('.spec.ts'),
    )
    .map((e) => path.join(dir, e.name));
}

function verificarController(filePath: string): string[] {
  const conteudo = fs.readFileSync(filePath, 'utf8');
  const linhas = conteudo.split('\n');
  const violacoes: string[] = [];

  for (let i = 0; i < linhas.length; i++) {
    if (!RE_HTTP_METHOD.test(linhas[i])) continue;

    // Busca @Roles() ou @Public() nas próximas 6 linhas (bloco de decorators)
    const fim = Math.min(i + 6, linhas.length);
    const temGuard = linhas.slice(i + 1, fim).some((l) => RE_GUARD.test(l));

    if (!temGuard) {
      violacoes.push(
        `${path.relative(process.cwd(), filePath)}:${i + 1}\n    ${linhas[i].trim()}`,
      );
    }
  }

  return violacoes;
}

describe('[Invariante] Endpoints operacionais — @Roles() ou @Public() obrigatório', () => {
  it.each(MODULOS_OPERACIONAIS)(
    'módulo %s — todos os handlers têm @Roles() ou @Public()',
    (modulo) => {
      const dir = path.join(MODULES_DIR, modulo);
      const controllers = listarControllers(dir);

      if (controllers.length === 0) return;

      const violacoes = controllers.flatMap(verificarController);

      if (violacoes.length > 0) {
        throw new Error(
          `[Invariante @Roles] Handlers sem @Roles() ou @Public() em "${modulo}".\n` +
            `Adicione @Roles() ao handler ou @Public() se for rota pública. Violações:\n\n` +
            violacoes.join('\n\n'),
        );
      }
    },
  );
});
