/**
 * Calcula o ciclo bimestral atual (1–6).
 * Fórmula: Math.ceil((month + 1) / 2), onde month = 0–11.
 *
 * Jan–Fev → 1 | Mar–Abr → 2 | Mai–Jun → 3
 * Jul–Ago → 4 | Set–Out → 5 | Nov–Dez → 6
 */
export function getCurrentCiclo(): number {
  return Math.ceil((new Date().getMonth() + 1) / 2);
}
