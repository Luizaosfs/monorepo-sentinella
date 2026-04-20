/**
 * api-stub.ts — stub para módulos operacionais sem endpoint NestJS implementado.
 * Todos os métodos retornam null/[] — degradam graciosamente até implementação.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsyncFn = (...args: any[]) => Promise<any>;

const asyncNull: AnyAsyncFn = () => Promise.resolve(null);
const asyncEmpty: AnyAsyncFn = () => Promise.resolve([]);
const asyncVoid: AnyAsyncFn = () => Promise.resolve(undefined);

function makeModuleStub(): Record<string, AnyAsyncFn> {
  return new Proxy({} as Record<string, AnyAsyncFn>, {
    get(_t, method) {
      if (typeof method === 'symbol') return undefined;
      const name = String(method);
      if (name.startsWith('list') || name.startsWith('filter') || name === 'calcular') return asyncEmpty;
      if (
        name.startsWith('delete') || name.startsWith('remove') || name.startsWith('update') ||
        name.startsWith('save') || name.startsWith('upsert') || name.startsWith('create') ||
        name.startsWith('insert') || name.startsWith('add') || name.startsWith('trigger') ||
        name.startsWith('enviar') || name.startsWith('registrar') || name.startsWith('marcar') ||
        name.startsWith('cancel') || name.startsWith('retry') || name.startsWith('copiar')
      ) return asyncVoid;
      return asyncNull;
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: any = new Proxy({} as Record<string, Record<string, AnyAsyncFn>>, {
  get(_t, module) {
    if (typeof module === 'symbol') return undefined;
    return makeModuleStub();
  },
});
