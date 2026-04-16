/**
 * DimensoesBadges — Linha de badges compactos para as 4 dimensões analíticas
 * + resultado operacional da consolidação.
 * Usado em listagens e fichas para visão rápida do perfil de risco.
 */
import { cn } from '@/lib/utils';
import type { Vistoria } from '@/types/database';

type DimensaoVD = Vistoria['vulnerabilidade_domiciliar'];
type DimensaoAS = Vistoria['alerta_saude'];
type DimensaoSA = Vistoria['risco_socioambiental'];
type DimensaoRV = Vistoria['risco_vetorial'];
type DimensaoRO = Vistoria['resultado_operacional'];

// ── Cores por nível ──────────────────────────────────────────────────────────

const VD_CFG: Record<NonNullable<DimensaoVD>, { label: string; color: string }> = {
  baixa:        { label: 'Vuln. baixa',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  media:        { label: 'Vuln. média',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  alta:         { label: 'Vuln. alta',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica:      { label: 'Vuln. crítica',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold' },
  inconclusivo: { label: 'Vuln. ?',        color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const AS_CFG: Record<NonNullable<DimensaoAS>, { label: string; color: string }> = {
  nenhum:       { label: 'Saúde ok',       color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  atencao:      { label: 'Saúde atenção',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  urgente:      { label: 'Saúde urgente',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold' },
  inconclusivo: { label: 'Saúde ?',        color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const SA_CFG: Record<NonNullable<DimensaoSA>, { label: string; color: string }> = {
  baixo:        { label: 'Social baixo',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medio:        { label: 'Social médio',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  alto:         { label: 'Social alto',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  inconclusivo: { label: 'Social ?',       color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const RV_CFG: Record<NonNullable<DimensaoRV>, { label: string; color: string }> = {
  baixo:        { label: 'Vetorial baixo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medio:        { label: 'Vetorial médio', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  alto:         { label: 'Vetorial alto',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critico:      { label: 'Vetorial crítico', color: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200 font-bold' },
  inconclusivo: { label: 'Vetorial ?',     color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

// Resultado operacional — apenas sem_acesso/retorno geram badge visível;
// 'visitado' não exibe nada (estado normal esperado).
const RO_CFG: Partial<Record<NonNullable<DimensaoRO>, { label: string; color: string }>> = {
  sem_acesso:        { label: 'Sem acesso',        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium' },
  sem_acesso_retorno:{ label: 'Sem acesso (2ª+)',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold' },
};

interface DimensoesBadgesProps {
  vulnerabilidade_domiciliar?: DimensaoVD;
  alerta_saude?: DimensaoAS;
  risco_socioambiental?: DimensaoSA;
  risco_vetorial?: DimensaoRV;
  /** Resultado operacional da visita — exibe badge apenas quando sem_acesso / sem_acesso_retorno */
  resultado_operacional?: DimensaoRO;
  /** Ocultar dimensões sem valor (null). Default: true */
  hideNull?: boolean;
  className?: string;
}

export function DimensoesBadges({
  vulnerabilidade_domiciliar,
  alerta_saude,
  risco_socioambiental,
  risco_vetorial,
  resultado_operacional,
  hideNull = true,
  className,
}: DimensoesBadgesProps) {
  const roBadge = resultado_operacional ? RO_CFG[resultado_operacional] ?? null : null;
  const badges = [
    roBadge,
    vulnerabilidade_domiciliar ? VD_CFG[vulnerabilidade_domiciliar] : null,
    alerta_saude               ? AS_CFG[alerta_saude]               : null,
    risco_socioambiental       ? SA_CFG[risco_socioambiental]       : null,
    risco_vetorial             ? RV_CFG[risco_vetorial]             : null,
  ].filter((b) => !hideNull || b !== null) as Array<{ label: string; color: string }>;

  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={cn(
            'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded',
            b.color,
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
