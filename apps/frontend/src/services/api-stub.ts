/**
 * api-stub.ts — Stub Phase 3: desacopla api.ts do Supabase nos módulos operacionais.
 *
 * A interface pública é compatível com api-supabase.ts via cast.
 * Todos os métodos retornam null/[] — nenhuma chamada ao Supabase via api.ts.
 * Módulos afetados degradam graciosamente até que seus endpoints NestJS sejam implementados.
 *
 * NOTA: @supabase/supabase-js permanece no projeto para:
 *   - Realtime (useMapaFocosRealtime, useRealtimeInvalidator)
 *   - Páginas públicas (DenunciaCidadao, PortalDenuncia, ConsultaProtocolo)
 *   - Reset de senha (TrocarSenha, ResetPassword)
 *   - pilotoEventos (fire-and-forget logging)
 *   Esses módulos serão migrados ao NestJS em fases posteriores.
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
