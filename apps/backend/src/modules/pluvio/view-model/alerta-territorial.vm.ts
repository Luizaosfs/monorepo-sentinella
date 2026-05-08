export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico';

export interface AlertaTerritorialItem {
  regiaoId: string;
  regiaoNome: string;
  nivelRiscoPluvio: NivelRisco;
  chuva24hMm: number;
  chuva72hMm: number;
  chuva7dMm: number;
  tendencia: string | null;
  justificativas: string[];
  recomendacao: string;
}

export interface AlertaTerritorialResponse {
  atualizadoEm: string;
  totalRegioesMonitoradas: number;
  totalRegioesEmAlerta: number;
  severidadeGeral: NivelRisco;
  alertas: AlertaTerritorialItem[];
}

const SEV_ORDER: Record<NivelRisco, number> = { critico: 3, alto: 2, medio: 1, baixo: 0 };

export function calcularSeveridadeGeral(niveis: NivelRisco[]): NivelRisco {
  if (niveis.length === 0) return 'baixo';
  return niveis.reduce(
    (max, n) => (SEV_ORDER[n] > SEV_ORDER[max] ? n : max),
    'baixo' as NivelRisco,
  );
}

export function gerarJustificativas(row: {
  chuva_24h: number;
  chuva_72h: number;
  chuva_7d: number;
  tendencia: string | null;
  situacao_ambiental: string | null;
}): string[] {
  const j: string[] = [];
  if (row.chuva_24h > 30)       j.push(`${row.chuva_24h.toFixed(1)}mm nas últimas 24h — limiar crítico`);
  else if (row.chuva_24h > 15)  j.push(`${row.chuva_24h.toFixed(1)}mm nas últimas 24h — nível elevado`);
  if (row.chuva_72h > 60)       j.push(`${row.chuva_72h.toFixed(1)}mm em 72h — solo saturado`);
  else if (row.chuva_72h > 30)  j.push(`${row.chuva_72h.toFixed(1)}mm em 72h — acúmulo significativo`);
  if (row.chuva_7d > 50)        j.push(`${row.chuva_7d.toFixed(1)}mm em 7 dias — persistência de risco`);
  if (row.tendencia === 'crescente') j.push('Tendência crescente de precipitação');
  if (row.situacao_ambiental === 'favoravel_proliferacao')
    j.push('Condições favoráveis à proliferação do Aedes aegypti');
  return j.length > 0 ? j : ['Nível de risco elevado com base nos dados pluviométricos'];
}

export function gerarRecomendacao(nivel: NivelRisco): string {
  switch (nivel) {
    case 'critico': return 'Priorizar vistoria preventiva nas próximas 24h';
    case 'alto':    return 'Reforçar cobertura territorial nas próximas 48h';
    case 'medio':   return 'Monitorar e manter rota preventiva';
    default:        return 'Sem ação extraordinária';
  }
}
