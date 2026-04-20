import { describe, it, expect } from 'vitest';
import { podeTransicionar, getTransicoesPermitidas } from './transicoesFoco';
import { TRANSICOES_PERMITIDAS } from '@/types/database';
import type { FocoRiscoStatus } from '@/types/database';

const ALL_STATUS: FocoRiscoStatus[] = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'confirmado',
  'em_tratamento',
  'resolvido',
  'descartado',
];

const TERMINAL: FocoRiscoStatus[] = ['resolvido', 'descartado'];

// ── getTransicoesPermitidas ─────────────────────────────────────────────────

describe('getTransicoesPermitidas', () => {
  it('retorna lista vazia para resolvido', () => {
    expect(getTransicoesPermitidas('resolvido')).toEqual([]);
  });

  it('retorna lista vazia para descartado', () => {
    expect(getTransicoesPermitidas('descartado')).toEqual([]);
  });

  it('espelha TRANSICOES_PERMITIDAS para suspeita', () => {
    expect(getTransicoesPermitidas('suspeita')).toEqual(TRANSICOES_PERMITIDAS.suspeita);
  });

  it('espelha TRANSICOES_PERMITIDAS para em_triagem', () => {
    expect(getTransicoesPermitidas('em_triagem')).toEqual(TRANSICOES_PERMITIDAS.em_triagem);
  });

  it('espelha TRANSICOES_PERMITIDAS para aguarda_inspecao', () => {
    expect(getTransicoesPermitidas('aguarda_inspecao')).toEqual(TRANSICOES_PERMITIDAS.aguarda_inspecao);
  });

  it('espelha TRANSICOES_PERMITIDAS para confirmado', () => {
    expect(getTransicoesPermitidas('confirmado')).toEqual(TRANSICOES_PERMITIDAS.confirmado);
  });

  it('espelha TRANSICOES_PERMITIDAS para em_tratamento', () => {
    expect(getTransicoesPermitidas('em_tratamento')).toEqual(TRANSICOES_PERMITIDAS.em_tratamento);
  });

  it('todos os estados não-terminais possuem ao menos uma transição', () => {
    // suspeita: transição automática via trigger; sem transições manuais
    const naoTerminais = ALL_STATUS.filter((s) => !TERMINAL.includes(s) && s !== 'suspeita');
    for (const s of naoTerminais) {
      expect(getTransicoesPermitidas(s).length).toBeGreaterThan(0);
    }
  });

  it('nenhum estado aponta para si mesmo', () => {
    for (const s of ALL_STATUS) {
      expect(getTransicoesPermitidas(s)).not.toContain(s);
    }
  });

  it('nenhuma transição aponta de volta para suspeita (sem ciclos para o início)', () => {
    for (const s of ALL_STATUS) {
      expect(getTransicoesPermitidas(s)).not.toContain('suspeita');
    }
  });

  it('estados terminais não aparecem como destino de estados não-terminais antes de em_tratamento', () => {
    // Somente em_tratamento pode ir para resolvido
    const podeChegar = ALL_STATUS.filter((s) =>
      getTransicoesPermitidas(s).includes('resolvido'),
    );
    expect(podeChegar).toEqual(['em_tratamento']);
    expect(podeChegar).not.toContain('suspeita');
    expect(podeChegar).not.toContain('em_triagem');
    expect(podeChegar).not.toContain('aguarda_inspecao');
  });
});

// ── podeTransicionar — transições válidas ───────────────────────────────────

describe('podeTransicionar — transições válidas', () => {
  // suspeita — transição automática via trigger; sem transições manuais
  it('suspeita → em_triagem (trigger, não manual)', () => expect(podeTransicionar('suspeita', 'em_triagem')).toBe(false));
  it('suspeita → aguarda_inspecao', () => expect(podeTransicionar('suspeita', 'aguarda_inspecao')).toBe(false));
  it('suspeita → descartado', () => expect(podeTransicionar('suspeita', 'descartado')).toBe(false));

  // em_triagem
  it('em_triagem → aguarda_inspecao', () => expect(podeTransicionar('em_triagem', 'aguarda_inspecao')).toBe(true));
  it('em_triagem → confirmado (inválido — deve passar por aguarda_inspecao)', () => expect(podeTransicionar('em_triagem', 'confirmado')).toBe(false));
  it('em_triagem → descartado (inválido — supervisor não descarta)', () => expect(podeTransicionar('em_triagem', 'descartado')).toBe(false));

  // aguarda_inspecao
  it('aguarda_inspecao → confirmado (inválido — deve passar por em_inspecao)', () => expect(podeTransicionar('aguarda_inspecao', 'confirmado')).toBe(false));
  it('aguarda_inspecao → descartado', () => expect(podeTransicionar('aguarda_inspecao', 'descartado')).toBe(true));

  // confirmado
  it('confirmado → em_tratamento', () => expect(podeTransicionar('confirmado', 'em_tratamento')).toBe(true));
  it('confirmado → resolvido (inválido — deve passar por em_tratamento)', () => expect(podeTransicionar('confirmado', 'resolvido')).toBe(false));

  // em_tratamento
  it('em_tratamento → resolvido', () => expect(podeTransicionar('em_tratamento', 'resolvido')).toBe(true));
  it('em_tratamento → descartado', () => expect(podeTransicionar('em_tratamento', 'descartado')).toBe(true));
});

// ── podeTransicionar — transições inválidas ─────────────────────────────────

describe('podeTransicionar — transições inválidas', () => {
  // suspeita não pode pular estados à frente
  it('suspeita → confirmado (inválido)', () => expect(podeTransicionar('suspeita', 'confirmado')).toBe(false));
  it('suspeita → em_tratamento (inválido)', () => expect(podeTransicionar('suspeita', 'em_tratamento')).toBe(false));
  it('suspeita → resolvido (inválido)', () => expect(podeTransicionar('suspeita', 'resolvido')).toBe(false));

  // em_triagem não pode ir diretamente para resolvido ou em_tratamento
  it('em_triagem → resolvido (inválido)', () => expect(podeTransicionar('em_triagem', 'resolvido')).toBe(false));
  it('em_triagem → em_tratamento (inválido)', () => expect(podeTransicionar('em_triagem', 'em_tratamento')).toBe(false));
  it('em_triagem → suspeita (inválido — sem regressão)', () => expect(podeTransicionar('em_triagem', 'suspeita')).toBe(false));

  // aguarda_inspecao não pode voltar ou pular
  it('aguarda_inspecao → suspeita (inválido)', () => expect(podeTransicionar('aguarda_inspecao', 'suspeita')).toBe(false));
  it('aguarda_inspecao → em_triagem (inválido)', () => expect(podeTransicionar('aguarda_inspecao', 'em_triagem')).toBe(false));
  it('aguarda_inspecao → em_tratamento (inválido)', () => expect(podeTransicionar('aguarda_inspecao', 'em_tratamento')).toBe(false));
  it('aguarda_inspecao → resolvido (inválido)', () => expect(podeTransicionar('aguarda_inspecao', 'resolvido')).toBe(false));

  // confirmado não pode ir para descartado nem regredir
  it('confirmado → descartado (inválido)', () => expect(podeTransicionar('confirmado', 'descartado')).toBe(false));
  it('confirmado → suspeita (inválido)', () => expect(podeTransicionar('confirmado', 'suspeita')).toBe(false));
  it('confirmado → em_triagem (inválido)', () => expect(podeTransicionar('confirmado', 'em_triagem')).toBe(false));
  it('confirmado → aguarda_inspecao (inválido)', () => expect(podeTransicionar('confirmado', 'aguarda_inspecao')).toBe(false));

  // em_tratamento não pode regredir
  it('em_tratamento → suspeita (inválido)', () => expect(podeTransicionar('em_tratamento', 'suspeita')).toBe(false));
  it('em_tratamento → confirmado (inválido)', () => expect(podeTransicionar('em_tratamento', 'confirmado')).toBe(false));
  it('em_tratamento → aguarda_inspecao (inválido)', () => expect(podeTransicionar('em_tratamento', 'aguarda_inspecao')).toBe(false));
});

// ── estados terminais — bloqueio total ─────────────────────────────────────

describe('podeTransicionar — estados terminais bloqueiam toda saída', () => {
  it.each(ALL_STATUS)('resolvido → %s (sempre false)', (destino) => {
    expect(podeTransicionar('resolvido', destino as FocoRiscoStatus)).toBe(false);
  });

  it.each(ALL_STATUS)('descartado → %s (sempre false)', (destino) => {
    expect(podeTransicionar('descartado', destino as FocoRiscoStatus)).toBe(false);
  });
});

// ── auto-transição (estado → mesmo estado) — sempre inválida ───────────────

describe('podeTransicionar — auto-transição inválida para todos os estados', () => {
  it.each(ALL_STATUS)('%s → %s (auto-transição inválida)', (estado) => {
    expect(podeTransicionar(estado as FocoRiscoStatus, estado as FocoRiscoStatus)).toBe(false);
  });
});

// ── consistência bidirecional ───────────────────────────────────────────────

describe('podeTransicionar — consistência com getTransicoesPermitidas', () => {
  it('podeTransicionar(de, para) === true ↔ para está em getTransicoesPermitidas(de)', () => {
    for (const de of ALL_STATUS) {
      const permitidos = getTransicoesPermitidas(de as FocoRiscoStatus);
      for (const para of ALL_STATUS) {
        const esperado = permitidos.includes(para as FocoRiscoStatus);
        expect(podeTransicionar(de as FocoRiscoStatus, para as FocoRiscoStatus)).toBe(esperado);
      }
    }
  });
});

// ── estado em_inspecao (8º estado adicionado em 2026-04) ───────────────────

describe('getTransicoesPermitidas — em_inspecao', () => {
  it('espelha TRANSICOES_PERMITIDAS para em_inspecao', () => {
    expect(getTransicoesPermitidas('em_inspecao')).toEqual(TRANSICOES_PERMITIDAS.em_inspecao);
  });

  it('em_inspecao possui ao menos uma transição permitida', () => {
    expect(getTransicoesPermitidas('em_inspecao').length).toBeGreaterThan(0);
  });

  it('em_inspecao não aponta para si mesmo', () => {
    expect(getTransicoesPermitidas('em_inspecao')).not.toContain('em_inspecao');
  });

  it('em_inspecao não aponta de volta para suspeita', () => {
    expect(getTransicoesPermitidas('em_inspecao')).not.toContain('suspeita');
  });
});

describe('podeTransicionar — transições válidas envolvendo em_inspecao', () => {
  it('aguarda_inspecao → em_inspecao (agente inicia inspeção de campo)', () =>
    expect(podeTransicionar('aguarda_inspecao', 'em_inspecao')).toBe(true));

  it('em_inspecao → confirmado (inspeção confirma o foco)', () =>
    expect(podeTransicionar('em_inspecao', 'confirmado')).toBe(true));

  it('em_inspecao → descartado (inspeção descarta o foco)', () =>
    expect(podeTransicionar('em_inspecao', 'descartado')).toBe(true));
});

describe('podeTransicionar — transições inválidas envolvendo em_inspecao', () => {
  it('suspeita → em_inspecao (inválido — deve passar por triagem)', () =>
    expect(podeTransicionar('suspeita', 'em_inspecao')).toBe(false));

  it('em_triagem → em_inspecao (inválido — deve passar por aguarda_inspecao)', () =>
    expect(podeTransicionar('em_triagem', 'em_inspecao')).toBe(false));

  it('confirmado → em_inspecao (inválido — sem regressão)', () =>
    expect(podeTransicionar('confirmado', 'em_inspecao')).toBe(false));

  it('em_tratamento → em_inspecao (inválido — sem regressão)', () =>
    expect(podeTransicionar('em_tratamento', 'em_inspecao')).toBe(false));

  it('resolvido → em_inspecao (inválido — terminal)', () =>
    expect(podeTransicionar('resolvido', 'em_inspecao')).toBe(false));

  it('descartado → em_inspecao (inválido — terminal)', () =>
    expect(podeTransicionar('descartado', 'em_inspecao')).toBe(false));

  it('em_inspecao → em_triagem (inválido — sem regressão)', () =>
    expect(podeTransicionar('em_inspecao', 'em_triagem')).toBe(false));

  it('em_inspecao → aguarda_inspecao (inválido — sem regressão)', () =>
    expect(podeTransicionar('em_inspecao', 'aguarda_inspecao')).toBe(false));

  it('em_inspecao → em_tratamento (inválido — deve confirmar primeiro)', () =>
    expect(podeTransicionar('em_inspecao', 'em_tratamento')).toBe(false));

  it('em_inspecao → resolvido (inválido — deve confirmar primeiro)', () =>
    expect(podeTransicionar('em_inspecao', 'resolvido')).toBe(false));
});
