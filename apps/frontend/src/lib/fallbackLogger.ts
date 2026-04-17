/**
 * fallbackLogger — telemetria leve de uso de fallback Supabase.
 *
 * Instrumenta os catch blocks de api.ts para medir quais endpoints
 * ainda dependem do Supabase em produção.
 *
 * NÃO remove nem desabilita o fallback — apenas registra.
 * Para desligar: setar VITE_DISABLE_FALLBACK_TELEMETRY=true
 */

const DISABLED = import.meta.env.VITE_DISABLE_FALLBACK_TELEMETRY === 'true';

/** Controle de frequência: evita spam de entradas idênticas num intervalo curto. */
const _recentKeys = new Map<string, number>();
const THROTTLE_MS = 30_000; // 30s por chave única

export interface FallbackEvent {
  domain: string;
  method: string;
  endpoint?: string;
  errorType: string;
  errorMessage: string;
  ts: string;
}

/**
 * Registra um evento de fallback.
 *
 * @param domain   Nome do domínio em api.ts (ex: 'focoRisco', 'vistoria')
 * @param method   Nome do método (ex: 'findById', 'list')
 * @param error    O erro capturado no catch
 * @param endpoint URL relativa tentada, se disponível
 */
export function logFallback(
  domain: string,
  method: string,
  error: unknown,
  endpoint?: string,
): void {
  if (DISABLED) return;

  const key = `${domain}::${method}`;
  const now = Date.now();
  const last = _recentKeys.get(key);
  if (last && now - last < THROTTLE_MS) return;
  _recentKeys.set(key, now);

  const errorType =
    error instanceof Error ? error.constructor.name : typeof error;
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  const event: FallbackEvent = {
    domain,
    method,
    endpoint,
    errorType,
    errorMessage: errorMessage.slice(0, 200),
    ts: new Date().toISOString(),
  };

  // Exibe no console em qualquer ambiente para facilitar diagnóstico
  console.warn('[fallback]', event);

  // Armazena os últimos 100 eventos em sessionStorage para inspeção
  try {
    const raw = sessionStorage.getItem('sentinella_fallback_log');
    const log: FallbackEvent[] = raw ? JSON.parse(raw) : [];
    log.push(event);
    if (log.length > 100) log.splice(0, log.length - 100);
    sessionStorage.setItem('sentinella_fallback_log', JSON.stringify(log));
  } catch {
    // sessionStorage pode estar bloqueado em modo privado
  }
}

/**
 * Retorna todos os eventos registrados nesta sessão.
 * Útil para inspecionar no console: `JSON.parse(sessionStorage.getItem('sentinella_fallback_log'))`.
 */
export function getFallbackLog(): FallbackEvent[] {
  try {
    const raw = sessionStorage.getItem('sentinella_fallback_log');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Retorna um resumo agrupado por domínio — útil para priorização.
 * Exemplo de uso no console: `import('@/lib/fallbackLogger').then(m => console.table(m.getFallbackSummary()))`
 */
export function getFallbackSummary(): Record<string, number> {
  const log = getFallbackLog();
  const summary: Record<string, number> = {};
  for (const event of log) {
    const key = `${event.domain}.${event.method}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}
