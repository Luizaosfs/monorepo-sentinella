import { describe, it, expect } from 'vitest';
import {
  mapFocoToStatusOperacional,
  LABEL_STATUS_OPERACIONAL,
  type FocoStatus,
} from './mapStatusOperacional';

describe('mapFocoToStatusOperacional', () => {
  // ── Grupo pendente ────────────────────────────────────────────────────────
  it('suspeita → pendente', () => {
    expect(mapFocoToStatusOperacional('suspeita')).toBe('pendente');
  });

  it('em_triagem → pendente', () => {
    expect(mapFocoToStatusOperacional('em_triagem')).toBe('pendente');
  });

  it('aguarda_inspecao → pendente', () => {
    expect(mapFocoToStatusOperacional('aguarda_inspecao')).toBe('pendente');
  });

  // ── Grupo em_atendimento ──────────────────────────────────────────────────
  it('em_inspecao → em_atendimento', () => {
    expect(mapFocoToStatusOperacional('em_inspecao')).toBe('em_atendimento');
  });

  it('confirmado → em_atendimento', () => {
    expect(mapFocoToStatusOperacional('confirmado')).toBe('em_atendimento');
  });

  it('em_tratamento → em_atendimento', () => {
    expect(mapFocoToStatusOperacional('em_tratamento')).toBe('em_atendimento');
  });

  // ── Grupo resolvido ───────────────────────────────────────────────────────
  it('resolvido → resolvido', () => {
    expect(mapFocoToStatusOperacional('resolvido')).toBe('resolvido');
  });

  it('descartado → resolvido', () => {
    expect(mapFocoToStatusOperacional('descartado')).toBe('resolvido');
  });

  // ── Cobertura exaustiva (runtime) ─────────────────────────────────────────
  it('todos os 8 status do FocoStatus produzem um StatusOperacional válido', () => {
    const todos: FocoStatus[] = [
      'suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao',
      'confirmado', 'em_tratamento', 'resolvido', 'descartado',
    ];
    const validos = new Set(['pendente', 'em_atendimento', 'resolvido']);
    for (const s of todos) {
      expect(validos).toContain(mapFocoToStatusOperacional(s));
    }
  });
});

describe('LABEL_STATUS_OPERACIONAL', () => {
  it('tem exatamente 3 chaves', () => {
    expect(Object.keys(LABEL_STATUS_OPERACIONAL)).toHaveLength(3);
  });

  it('contém labels para pendente, em_atendimento e resolvido', () => {
    expect(LABEL_STATUS_OPERACIONAL.pendente).toBeTruthy();
    expect(LABEL_STATUS_OPERACIONAL.em_atendimento).toBeTruthy();
    expect(LABEL_STATUS_OPERACIONAL.resolvido).toBeTruthy();
  });
});
