import type {
  FocoRiscoAtivo,
  FocoRiscoOrigem,
  FocoRiscoPrioridade,
  FocoRiscoStatus,
} from '@/types/database';

export type PeriodoGestorMapa = 'hoje' | '7d' | '30d' | 'all';

export type SlaStatusFiltro = 'ok' | 'atencao' | 'critico' | 'vencido' | 'sem_sla';

export type ScoreClassificacaoFiltro = 'baixo' | 'medio' | 'alto' | 'muito_alto' | 'critico';

export interface GestorMapaFocoFilterState {
  regiaoId: string | 'all';
  periodo: PeriodoGestorMapa;
  status: FocoRiscoStatus[];
  prioridade: FocoRiscoPrioridade[];
  origem: FocoRiscoOrigem[];
  slaStatus: SlaStatusFiltro[];
  scoreClassificacao: ScoreClassificacaoFiltro[];
}

export const DEFAULT_GESTOR_MAPA_FILTERS: GestorMapaFocoFilterState = {
  regiaoId: 'all',
  periodo: 'all',
  status: [],
  prioridade: [],
  origem: [],
  slaStatus: [],
  scoreClassificacao: [],
};

export function countGestorMapaFilterSelections(f: GestorMapaFocoFilterState): number {
  let n = 0;
  if (f.regiaoId !== 'all') n++;
  if (f.periodo !== 'all') n++;
  n += f.status.length + f.prioridade.length + f.origem.length + f.slaStatus.length + f.scoreClassificacao.length;
  return n;
}

function isWithinSuspeitaPeriod(suspeitaEm: string, periodo: PeriodoGestorMapa): boolean {
  if (periodo === 'all') return true;
  const t = new Date(suspeitaEm).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (periodo === 'hoje') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (periodo === '7d') return t >= now - 7 * dayMs;
  if (periodo === '30d') return t >= now - 30 * dayMs;
  return true;
}

export function filterFocosForGestorMapa(
  focos: FocoRiscoAtivo[],
  f: GestorMapaFocoFilterState,
): FocoRiscoAtivo[] {
  return focos.filter((x) => {
    if (f.regiaoId !== 'all' && x.regiao_id !== f.regiaoId) return false;
    if (!isWithinSuspeitaPeriod(x.suspeita_em, f.periodo)) return false;
    if (f.status.length > 0 && !f.status.includes(x.status)) return false;
    if (f.prioridade.length > 0) {
      if (!x.prioridade || !f.prioridade.includes(x.prioridade)) return false;
    }
    if (f.origem.length > 0 && !f.origem.includes(x.origem_tipo)) return false;
    if (f.slaStatus.length > 0 && !f.slaStatus.includes(x.sla_status)) return false;
    if (f.scoreClassificacao.length > 0) {
      if (!x.score_classificacao || !f.scoreClassificacao.includes(x.score_classificacao)) return false;
    }
    return true;
  });
}

export interface GestorMapaFocoStats {
  total: number;
  urgentesP1P2: number;
  regioesDistintas: number;
  slaEmRisco: number;
}

export function computeGestorMapaFocoStats(focos: FocoRiscoAtivo[]): GestorMapaFocoStats {
  const total = focos.length;
  const urgentesP1P2 = focos.filter((x) => x.prioridade === 'P1' || x.prioridade === 'P2').length;
  const regioes = new Set(focos.map((x) => x.regiao_id).filter(Boolean));
  const slaEmRisco = focos.filter((x) =>
    ['atencao', 'critico', 'vencido'].includes(x.sla_status ?? ''),
  ).length;
  return {
    total,
    urgentesP1P2,
    regioesDistintas: regioes.size,
    slaEmRisco,
  };
}
