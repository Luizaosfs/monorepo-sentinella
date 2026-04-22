/**
 * Jest globalTeardown — roda UMA vez após toda a suíte e2e.
 *
 * Mantemos ainda o `--forceExit` no script (defesa contra timers órfãos
 * do schedule/throttler), mas tudo que damos como I/O conhecido é fechado
 * aqui para não mascarar vazamentos durante debug futuro.
 */
export default async function globalTeardown(): Promise<void> {
  // Nada explícito a fechar aqui ainda — cada spec é responsável por
  // chamar `app.close()` no afterAll. Este hook fica disponível para
  // próximas fases (pool de Prisma compartilhado, fixtures globais, etc.).
}
