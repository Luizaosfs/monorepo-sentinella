/**
 * Converte o texto de risco do banco para os ids usados nos filtros do mapa
 * (critico, alto, medio, baixo). Remove acentos para bater com "Crítico" / "Médio".
 */
export function normalizeRiskBucket(risco: string | null | undefined): string {
  const t = (risco ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!t) return 'indefinido';
  if (t.includes('critico')) return 'critico';
  if (t.includes('muito') && t.includes('alto')) return 'critico';
  if (t.includes('alto')) return 'alto';
  if (t.includes('medio')) return 'medio';
  if (t.includes('baixo')) return 'baixo';
  return t;
}
