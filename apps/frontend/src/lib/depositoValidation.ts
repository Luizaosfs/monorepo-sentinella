/**
 * depositoValidation.ts — Regras de negócio PNCD para vistoria de depósitos.
 * Funções puras — sem dependências externas.
 */

export function validarFocosNaoExcedemInspecionados(
  qtd_inspecionados: number,
  qtd_com_focos: number,
): boolean {
  return qtd_com_focos <= qtd_inspecionados;
}

export function validarEliminadosNaoExcedemFocos(
  qtd_com_focos: number,
  qtd_eliminados: number,
): boolean {
  return qtd_eliminados <= qtd_com_focos;
}

/** Calcula ciclo epidemiológico (1–6) baseado no mês de uma data. */
export function calcularCiclo(data: Date): number {
  return Math.ceil((data.getMonth() + 1) / 2);
}

/** Valida que um ciclo está no intervalo válido (1–6). */
export function cicloValido(ciclo: number): boolean {
  return Number.isInteger(ciclo) && ciclo >= 1 && ciclo <= 6;
}
