const ESCALA: Record<string, string> = {
  P5: 'P4',
  P4: 'P3',
  P3: 'P2',
  P2: 'P1',
  P1: 'P1',
};

export function elevarPrioridadeRecorrencia(prioridade: string | null | undefined): string {
  const base = prioridade ?? 'P3';
  return ESCALA[base] ?? ESCALA['P3'];
}
