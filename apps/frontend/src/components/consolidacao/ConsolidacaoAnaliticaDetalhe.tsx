/**
 * ConsolidacaoAnaliticaDetalhe — Bloco analítico avançado (modo analítico ativo).
 *
 * Exibe as 4 dimensões analíticas + resultado operacional de forma explícita e
 * rotulada, voltado para supervisor, admin e analista_regional.
 *
 * Regras:
 *  • Não recalcula nada — exibe apenas o que vem do banco
 *  • Não aparece em listas (apenas em telas de detalhe)
 *  • Não substitui DimensoesBadges — complementa
 *  • Dados ausentes (null) são exibidos como "Não coletado"
 */
import { cn } from '@/lib/utils';
import type { Vistoria } from '@/types/database';

// ── Mapeamentos de label ──────────────────────────────────────────────────────

const RO_LABEL: Record<NonNullable<Vistoria['resultado_operacional']>, { label: string; color: string }> = {
  visitado:           { label: 'Visitado',          color: 'text-green-700 dark:text-green-400' },
  sem_acesso:         { label: 'Sem acesso (1ª vez)', color: 'text-amber-700 dark:text-amber-400' },
  sem_acesso_retorno: { label: 'Sem acesso (2ª+ vez)', color: 'text-orange-700 dark:text-orange-400 font-semibold' },
};

const VD_LABEL: Record<NonNullable<Vistoria['vulnerabilidade_domiciliar']>, { label: string; color: string }> = {
  baixa:        { label: 'Baixa',        color: 'text-green-700 dark:text-green-400' },
  media:        { label: 'Média',        color: 'text-yellow-700 dark:text-yellow-400' },
  alta:         { label: 'Alta',         color: 'text-orange-700 dark:text-orange-400 font-semibold' },
  critica:      { label: 'Crítica',      color: 'text-red-700 dark:text-red-400 font-bold' },
  inconclusivo: { label: 'Inconclusivo', color: 'text-gray-500 dark:text-gray-400' },
};

const AS_LABEL: Record<NonNullable<Vistoria['alerta_saude']>, { label: string; color: string }> = {
  nenhum:       { label: 'Nenhum',       color: 'text-green-700 dark:text-green-400' },
  atencao:      { label: 'Atenção',      color: 'text-yellow-700 dark:text-yellow-400 font-semibold' },
  urgente:      { label: 'Urgente',      color: 'text-red-700 dark:text-red-400 font-bold' },
  inconclusivo: { label: 'Inconclusivo', color: 'text-gray-500 dark:text-gray-400' },
};

const SA_LABEL: Record<NonNullable<Vistoria['risco_socioambiental']>, { label: string; color: string }> = {
  baixo:        { label: 'Baixo',        color: 'text-green-700 dark:text-green-400' },
  medio:        { label: 'Médio',        color: 'text-yellow-700 dark:text-yellow-400 font-semibold' },
  alto:         { label: 'Alto',         color: 'text-orange-700 dark:text-orange-400 font-bold' },
  inconclusivo: { label: 'Inconclusivo', color: 'text-gray-500 dark:text-gray-400' },
};

const RV_LABEL: Record<NonNullable<Vistoria['risco_vetorial']>, { label: string; color: string }> = {
  baixo:        { label: 'Baixo',        color: 'text-green-700 dark:text-green-400' },
  medio:        { label: 'Médio',        color: 'text-yellow-700 dark:text-yellow-400' },
  alto:         { label: 'Alto',         color: 'text-orange-700 dark:text-orange-400 font-semibold' },
  critico:      { label: 'Crítico',      color: 'text-red-700 dark:text-red-400 font-bold' },
  inconclusivo: { label: 'Inconclusivo', color: 'text-gray-500 dark:text-gray-400' },
};

// ── Subcomponente linha ───────────────────────────────────────────────────────

function Linha({ label, valor, colorClass }: { label: string; valor: string; colorClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-[11px] font-medium text-right', colorClass ?? 'text-foreground')}>
        {valor}
      </span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ConsolidacaoAnaliticaDetalheProps {
  resultado_operacional?: Vistoria['resultado_operacional'];
  vulnerabilidade_domiciliar?: Vistoria['vulnerabilidade_domiciliar'];
  alerta_saude?: Vistoria['alerta_saude'];
  risco_socioambiental?: Vistoria['risco_socioambiental'];
  risco_vetorial?: Vistoria['risco_vetorial'];
  className?: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ConsolidacaoAnaliticaDetalhe({
  resultado_operacional,
  vulnerabilidade_domiciliar,
  alerta_saude,
  risco_socioambiental,
  risco_vetorial,
  className,
}: ConsolidacaoAnaliticaDetalheProps) {
  const naoColetado = { label: 'Não coletado', color: 'text-gray-400 dark:text-gray-500 italic' };

  const ro  = resultado_operacional      ? RO_LABEL[resultado_operacional]      : null;
  const vd  = vulnerabilidade_domiciliar ? VD_LABEL[vulnerabilidade_domiciliar] : null;
  const as_ = alerta_saude              ? AS_LABEL[alerta_saude]               : null;
  const sa  = risco_socioambiental      ? SA_LABEL[risco_socioambiental]       : null;
  const rv  = risco_vetorial            ? RV_LABEL[risco_vetorial]             : null;

  return (
    <div
      className={cn(
        'rounded-lg border border-blue-200/60 dark:border-blue-800/30 bg-blue-50/40 dark:bg-blue-950/10 px-3 py-2',
        className,
      )}
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          Análise da vistoria
        </p>
        <span className="text-[9px] text-blue-400/60 dark:text-blue-500/60 italic">somente leitura</span>
      </div>
      <div className="divide-y divide-border/30">
        <Linha
          label="Resultado operacional"
          valor={ro?.label ?? naoColetado.label}
          colorClass={ro?.color ?? naoColetado.color}
        />
        <Linha
          label="Vulnerabilidade domiciliar"
          valor={vd?.label ?? naoColetado.label}
          colorClass={vd?.color ?? naoColetado.color}
        />
        <Linha
          label="Alerta de saúde"
          valor={as_?.label ?? naoColetado.label}
          colorClass={as_?.color ?? naoColetado.color}
        />
        <Linha
          label="Risco socioambiental"
          valor={sa?.label ?? naoColetado.label}
          colorClass={sa?.color ?? naoColetado.color}
        />
        <Linha
          label="Risco vetorial"
          valor={rv?.label ?? naoColetado.label}
          colorClass={rv?.color ?? naoColetado.color}
        />
      </div>
    </div>
  );
}
