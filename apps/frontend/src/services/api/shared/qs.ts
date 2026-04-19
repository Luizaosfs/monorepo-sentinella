/** Monta query string, ignorando undefined/null. Arrays → múltiplos params. */
export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((i) => p.append(k, String(i)));
    else if (v instanceof Date) p.append(k, v.toISOString());
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
