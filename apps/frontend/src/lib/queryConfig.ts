/**
 * Constantes de configuração do React Query.
 *
 * Categorias de staleTime:
 *   LIVE      — dados que precisam estar sempre frescos (SLA iminentes, alertas)
 *   SHORT     — dados operacionais que mudam com frequência (SLAs, operações, itens)
 *   MEDIUM    — dados de estado moderado (levantamentos, mapa de itens)
 *   LONG      — bundles pesados que vale manter em cache (mapa completo)
 *   STATIC    — configurações que raramente mudam (catálogos, feriados, regiões, planos)
 *   SESSION   — nunca expira sozinho dentro da sessão (risk_policy, yolo config)
 *
 * gcTime (garbage collection) separado do staleTime:
 *   É quanto tempo o cache permanece na memória depois que o componente desmonta.
 *   Aumentado para operadores em campo — permite que dados fiquem disponíveis
 *   quando o dispositivo perde conexão temporariamente.
 */

const MIN = 60 * 1000;

export const STALE = {
  LIVE:        0,
  VERY_SHORT:  0.5 * MIN, //  30 s — SLA panel com polling intenso
  SHORT:       1   * MIN, //  1 min
  RECENT:      2   * MIN, //  2 min — dados dinâmicos: quotas, recorrências, evidências
  MEDIUM:      3   * MIN, //  3 min
  MODERATE:    5   * MIN, //  5 min — pluvio, planejamentos ativos, config de região
  MAP:         10  * MIN, // 10 min — bundle pesado map_full_data
  LONG:        10  * MIN, // 10 min
  EXTENDED:    15  * MIN, // 15 min — condições de voo (meteorologia)
  STATIC:      30  * MIN, // 30 min — catálogos, feriados, planos de ação
  SESSION:     Infinity,  // nunca expira dentro da sessão
} as const;

export const GC = {
  DEFAULT:   5  * MIN,  //  5 min — padrão React Query
  EXTENDED:  30 * MIN,  // 30 min — rotas de operador em campo (suporte offline)
  LONG:      60 * MIN,  //  1 h   — configurações estáticas
} as const;

/** Defaults do QueryClient para toda a aplicação. */
export const queryClientDefaults = {
  queries: {
    staleTime: STALE.MEDIUM,      // baseline: 3 min
    gcTime:    GC.EXTENDED,       // 30 min — mantém cache ao navegar entre rotas em campo
    retry: 1,
    refetchOnWindowFocus: false,
  },
} as const;
