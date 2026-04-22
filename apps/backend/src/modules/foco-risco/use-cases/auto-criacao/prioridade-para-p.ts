export type PrioridadeP = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export function prioridadeParaP(input: string | null | undefined): PrioridadeP {
  const normalized = (input ?? '').trim().toUpperCase();

  switch (normalized) {
    case 'P1':
    case 'CRÍTICO':
    case 'CRITICO':
    case 'CRÍTICA':
    case 'CRITICA':
    case 'URGENTE':
      return 'P1';
    case 'P2':
    case 'ALTA':
      return 'P2';
    case 'P3':
    case 'MÉDIA':
    case 'MEDIA':
    case 'MODERADA':
    case 'MODERADO':
      return 'P3';
    case 'P4':
    case 'BAIXA':
      return 'P4';
    case 'P5':
    case 'MONITORAMENTO':
      return 'P5';
    default:
      return 'P3';
  }
}
