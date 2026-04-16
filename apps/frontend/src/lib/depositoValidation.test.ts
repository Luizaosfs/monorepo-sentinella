import { describe, it, expect } from 'vitest';
import {
  validarFocosNaoExcedemInspecionados,
  validarEliminadosNaoExcedemFocos,
  calcularCiclo,
  cicloValido,
} from './depositoValidation';

describe('validarFocosNaoExcedemInspecionados', () => {
  it('retorna true quando focos são menores que inspecionados (5, 3)', () => {
    expect(validarFocosNaoExcedemInspecionados(5, 3)).toBe(true);
  });

  it('retorna true quando focos são iguais aos inspecionados (5, 5)', () => {
    expect(validarFocosNaoExcedemInspecionados(5, 5)).toBe(true);
  });

  it('retorna false quando focos excedem inspecionados (5, 6)', () => {
    expect(validarFocosNaoExcedemInspecionados(5, 6)).toBe(false);
  });

  it('retorna true quando ambos são zero (0, 0)', () => {
    expect(validarFocosNaoExcedemInspecionados(0, 0)).toBe(true);
  });

  it('retorna false quando há focos mas nenhum inspecionado (0, 1)', () => {
    expect(validarFocosNaoExcedemInspecionados(0, 1)).toBe(false);
  });
});

describe('validarEliminadosNaoExcedemFocos', () => {
  it('retorna true quando eliminados são menores que focos (3, 2)', () => {
    expect(validarEliminadosNaoExcedemFocos(3, 2)).toBe(true);
  });

  it('retorna true quando eliminados são iguais aos focos (3, 3)', () => {
    expect(validarEliminadosNaoExcedemFocos(3, 3)).toBe(true);
  });

  it('retorna false quando eliminados excedem focos (3, 4)', () => {
    expect(validarEliminadosNaoExcedemFocos(3, 4)).toBe(false);
  });

  it('retorna true quando ambos são zero (0, 0)', () => {
    expect(validarEliminadosNaoExcedemFocos(0, 0)).toBe(true);
  });

  it('retorna false quando há eliminados mas nenhum foco (0, 1)', () => {
    expect(validarEliminadosNaoExcedemFocos(0, 1)).toBe(false);
  });
});

describe('calcularCiclo', () => {
  it('Janeiro retorna ciclo 1', () => {
    expect(calcularCiclo(new Date(2025, 0, 15))).toBe(1);
  });

  it('Fevereiro retorna ciclo 1', () => {
    expect(calcularCiclo(new Date(2025, 1, 15))).toBe(1);
  });

  it('Março retorna ciclo 2', () => {
    expect(calcularCiclo(new Date(2025, 2, 15))).toBe(2);
  });

  it('Abril retorna ciclo 2', () => {
    expect(calcularCiclo(new Date(2025, 3, 15))).toBe(2);
  });

  it('Maio retorna ciclo 3', () => {
    expect(calcularCiclo(new Date(2025, 4, 15))).toBe(3);
  });

  it('Junho retorna ciclo 3', () => {
    expect(calcularCiclo(new Date(2025, 5, 15))).toBe(3);
  });

  it('Julho retorna ciclo 4', () => {
    expect(calcularCiclo(new Date(2025, 6, 15))).toBe(4);
  });

  it('Agosto retorna ciclo 4', () => {
    expect(calcularCiclo(new Date(2025, 7, 15))).toBe(4);
  });

  it('Setembro retorna ciclo 5', () => {
    expect(calcularCiclo(new Date(2025, 8, 15))).toBe(5);
  });

  it('Outubro retorna ciclo 5', () => {
    expect(calcularCiclo(new Date(2025, 9, 15))).toBe(5);
  });

  it('Novembro retorna ciclo 6', () => {
    expect(calcularCiclo(new Date(2025, 10, 15))).toBe(6);
  });

  it('Dezembro retorna ciclo 6', () => {
    expect(calcularCiclo(new Date(2025, 11, 15))).toBe(6);
  });

  it('todos os resultados estão entre 1 e 6', () => {
    for (let mes = 0; mes <= 11; mes++) {
      const ciclo = calcularCiclo(new Date(2025, mes, 1));
      expect(ciclo).toBeGreaterThanOrEqual(1);
      expect(ciclo).toBeLessThanOrEqual(6);
    }
  });
});

describe('cicloValido', () => {
  it('retorna true para ciclo 1 (mínimo válido)', () => {
    expect(cicloValido(1)).toBe(true);
  });

  it('retorna true para ciclo 3 (valor intermediário)', () => {
    expect(cicloValido(3)).toBe(true);
  });

  it('retorna true para ciclo 6 (máximo válido)', () => {
    expect(cicloValido(6)).toBe(true);
  });

  it('retorna false para ciclo 0 (abaixo do mínimo)', () => {
    expect(cicloValido(0)).toBe(false);
  });

  it('retorna false para ciclo 7 (acima do máximo)', () => {
    expect(cicloValido(7)).toBe(false);
  });

  it('retorna false para ciclo -1 (negativo)', () => {
    expect(cicloValido(-1)).toBe(false);
  });

  it('retorna false para ciclo 6.5 (não inteiro)', () => {
    expect(cicloValido(6.5)).toBe(false);
  });
});
