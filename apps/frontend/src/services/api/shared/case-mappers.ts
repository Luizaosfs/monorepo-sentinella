export type Await<T> = T extends Promise<infer U> ? U : T;
export type Ret<T extends (...args: never[]) => unknown> = Await<ReturnType<T>>;

/**
 * Converte recursivamente chaves snake_case → camelCase.
 * Usado para adaptar payloads do frontend (Supabase snake_case) para o backend NestJS (camelCase).
 */
export function deepToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepToCamel);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[key] = deepToCamel(v);
    }
    return result;
  }
  return obj;
}

/**
 * Converte recursivamente chaves camelCase → snake_case.
 * Usado para adaptar respostas do backend NestJS (camelCase) para os tipos do frontend (snake_case).
 */
export function deepToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepToSnake);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
      result[key] = deepToSnake(v);
    }
    return result;
  }
  return obj;
}
