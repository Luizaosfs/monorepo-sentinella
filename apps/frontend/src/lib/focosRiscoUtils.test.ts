import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  transicionar: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/api', () => ({
  api: {
    focosRisco: {
      transicionar: mocks.transicionar,
    },
  },
}));

import {
  focoStatusToAtendimento,
  atendimentoToFocoAlvo,
  buildFocoPath,
  avancarFocoAte,
} from './focosRiscoUtils';

// ── focoStatusToAtendimento ───────────────────────────────────────────────────

describe('focoStatusToAtendimento', () => {
  it('mapeia resolvido → resolvido', () => {
    expect(focoStatusToAtendimento('resolvido')).toBe('resolvido');
  });

  it('mapeia confirmado → em_atendimento', () => {
    expect(focoStatusToAtendimento('confirmado')).toBe('em_atendimento');
  });

  it('mapeia em_tratamento → em_atendimento', () => {
    expect(focoStatusToAtendimento('em_tratamento')).toBe('em_atendimento');
  });

  it('mapeia suspeita → pendente', () => {
    expect(focoStatusToAtendimento('suspeita')).toBe('pendente');
  });

  it('mapeia em_triagem → pendente', () => {
    expect(focoStatusToAtendimento('em_triagem')).toBe('pendente');
  });

  it('mapeia aguarda_inspecao → pendente', () => {
    expect(focoStatusToAtendimento('aguarda_inspecao')).toBe('pendente');
  });

  it('mapeia descartado → resolvido (atendimento encerrado)', () => {
    expect(focoStatusToAtendimento('descartado')).toBe('resolvido');
  });
});

// ── atendimentoToFocoAlvo ─────────────────────────────────────────────────────

describe('atendimentoToFocoAlvo', () => {
  it('mapeia resolvido → resolvido', () => {
    expect(atendimentoToFocoAlvo('resolvido')).toBe('resolvido');
  });

  it('mapeia em_atendimento → em_tratamento', () => {
    expect(atendimentoToFocoAlvo('em_atendimento')).toBe('em_tratamento');
  });

  it('mapeia pendente → descartado', () => {
    expect(atendimentoToFocoAlvo('pendente')).toBe('descartado');
  });
});

// ── buildFocoPath → resolvido ─────────────────────────────────────────────────

describe('buildFocoPath → resolvido (fluxo canônico)', () => {
  it('suspeita → resolvido: sem caminho (triagem é automática; buildFocoPath não opera em suspeita)', () => {
    expect(buildFocoPath('suspeita', 'resolvido')).toEqual([]);
  });

  it('em_triagem → resolvido: sem caminho (distribuição é via rpc_atribuir_agente_foco)', () => {
    expect(buildFocoPath('em_triagem', 'resolvido')).toEqual([]);
  });

  it('aguarda_inspecao → resolvido: passa por em_inspecao, confirmado, em_tratamento', () => {
    expect(buildFocoPath('aguarda_inspecao', 'resolvido')).toEqual([
      'em_inspecao', 'confirmado', 'em_tratamento', 'resolvido',
    ]);
  });

  it('em_inspecao → resolvido: passa por confirmado e em_tratamento', () => {
    expect(buildFocoPath('em_inspecao', 'resolvido')).toEqual([
      'confirmado', 'em_tratamento', 'resolvido',
    ]);
  });

  it('confirmado → resolvido: passa por em_tratamento', () => {
    expect(buildFocoPath('confirmado', 'resolvido')).toEqual(['em_tratamento', 'resolvido']);
  });

  it('em_tratamento → resolvido: passo único', () => {
    expect(buildFocoPath('em_tratamento', 'resolvido')).toEqual(['resolvido']);
  });

  it('resolvido → resolvido: retorna vazio (terminal)', () => {
    expect(buildFocoPath('resolvido', 'resolvido')).toEqual([]);
  });
});

// ── buildFocoPath → em_tratamento ─────────────────────────────────────────────

describe('buildFocoPath → em_tratamento (fluxo canônico)', () => {
  it('suspeita → em_tratamento: sem caminho', () => {
    expect(buildFocoPath('suspeita', 'em_tratamento')).toEqual([]);
  });

  it('em_triagem → em_tratamento: sem caminho', () => {
    expect(buildFocoPath('em_triagem', 'em_tratamento')).toEqual([]);
  });

  it('aguarda_inspecao → em_tratamento: passa por em_inspecao e confirmado', () => {
    expect(buildFocoPath('aguarda_inspecao', 'em_tratamento')).toEqual([
      'em_inspecao', 'confirmado', 'em_tratamento',
    ]);
  });

  it('em_inspecao → em_tratamento: passa por confirmado', () => {
    expect(buildFocoPath('em_inspecao', 'em_tratamento')).toEqual(['confirmado', 'em_tratamento']);
  });

  it('confirmado → em_tratamento: passo único', () => {
    expect(buildFocoPath('confirmado', 'em_tratamento')).toEqual(['em_tratamento']);
  });

  it('em_tratamento → em_tratamento: retorna vazio (sem auto-transição)', () => {
    expect(buildFocoPath('em_tratamento', 'em_tratamento')).toEqual([]);
  });
});

// ── buildFocoPath → descartado ────────────────────────────────────────────────

describe('buildFocoPath → descartado', () => {
  it('suspeita → descartado: sem caminho (suspeita não opera manualmente)', () => {
    expect(buildFocoPath('suspeita', 'descartado')).toEqual([]);
  });

  it('em_triagem → descartado: sem caminho (supervisor não descarta; agente não opera em_triagem)', () => {
    expect(buildFocoPath('em_triagem', 'descartado')).toEqual([]);
  });

  it('aguarda_inspecao → descartado: passo único', () => {
    expect(buildFocoPath('aguarda_inspecao', 'descartado')).toEqual(['descartado']);
  });

  it('em_inspecao → descartado: passo único', () => {
    expect(buildFocoPath('em_inspecao', 'descartado')).toEqual(['descartado']);
  });

  it('confirmado → descartado: sem caminho (confirmado só vai para em_tratamento)', () => {
    expect(buildFocoPath('confirmado', 'descartado')).toEqual([]);
  });

  it('em_tratamento → descartado: passo único', () => {
    expect(buildFocoPath('em_tratamento', 'descartado')).toEqual(['descartado']);
  });

  it('resolvido → descartado: retorna vazio (terminal)', () => {
    expect(buildFocoPath('resolvido', 'descartado')).toEqual([]);
  });

  it('descartado → descartado: retorna vazio (já é terminal)', () => {
    expect(buildFocoPath('descartado', 'descartado')).toEqual([]);
  });
});

// ── buildFocoPath — outros destinos ───────────────────────────────────────────

describe('buildFocoPath — destinos sem caminho', () => {
  it('resolvido → confirmado: retorna vazio', () => {
    expect(buildFocoPath('resolvido', 'confirmado')).toEqual([]);
  });

  it('descartado → em_tratamento: retorna vazio', () => {
    expect(buildFocoPath('descartado', 'em_tratamento')).toEqual([]);
  });

  it('aguarda_inspecao → em_inspecao: passo único', () => {
    expect(buildFocoPath('aguarda_inspecao', 'em_inspecao')).toEqual(['em_inspecao']);
  });

  it('em_inspecao → confirmado: passo único', () => {
    expect(buildFocoPath('em_inspecao', 'confirmado')).toEqual(['confirmado']);
  });
});

// ── Regras de papel — transições bloqueadas ───────────────────────────────────

describe('buildFocoPath — bloqueios por regra de papel (P0.1)', () => {
  // B1: supervisor não pode descartar em nenhuma etapa
  it('em_triagem → descartado: bloqueado (supervisor não descarta)', () => {
    expect(buildFocoPath('em_triagem', 'descartado')).toEqual([]);
  });

  it('suspeita → descartado: bloqueado (nenhum papel opera suspeita manualmente)', () => {
    expect(buildFocoPath('suspeita', 'descartado')).toEqual([]);
  });

  // State machine: confirmado só pode ir para em_tratamento
  it('confirmado → descartado: bloqueado (state machine não permite; só confirmado → em_tratamento)', () => {
    expect(buildFocoPath('confirmado', 'descartado')).toEqual([]);
  });

  // C1: reatribuição — buildFocoPath não cobre em_inspecao em diante como origem de descarte
  it('em_inspecao → descartado: permitido (agente executa)', () => {
    expect(buildFocoPath('em_inspecao', 'descartado')).toEqual(['descartado']);
  });

  it('aguarda_inspecao → descartado: permitido (agente executa)', () => {
    expect(buildFocoPath('aguarda_inspecao', 'descartado')).toEqual(['descartado']);
  });

  it('em_tratamento → descartado: permitido (agente executa)', () => {
    expect(buildFocoPath('em_tratamento', 'descartado')).toEqual(['descartado']);
  });

  // Reatribuição: estados onde supervisor pode re-atribuir vs não pode
  // (validada pelo rpc_atribuir_agente_foco; buildFocoPath não cobre, apenas documenta)
  it('suspeita não tem transição manual para nenhum destino', () => {
    expect(buildFocoPath('suspeita', 'resolvido')).toEqual([]);
    expect(buildFocoPath('suspeita', 'em_tratamento')).toEqual([]);
    expect(buildFocoPath('suspeita', 'descartado')).toEqual([]);
  });
});

// ── avancarFocoAte ────────────────────────────────────────────────────────────

describe('avancarFocoAte', () => {
  beforeEach(() => {
    mocks.transicionar.mockClear();
  });

  it('confirmado → resolvido: chama transicionar duas vezes (confirmado→em_tratamento→resolvido)', async () => {
    await avancarFocoAte('fid', 'confirmado', 'resolvido');
    expect(mocks.transicionar).toHaveBeenCalledTimes(2);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(1, 'fid', 'em_tratamento', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(2, 'fid', 'resolvido', undefined);
  });

  it('repassa motivo no último passo', async () => {
    await avancarFocoAte('fid', 'em_tratamento', 'resolvido', 'tratamento concluído');
    expect(mocks.transicionar).toHaveBeenCalledWith('fid', 'resolvido', 'tratamento concluído');
  });

  it('aguarda_inspecao → resolvido: chama transicionar 4 vezes', async () => {
    await avancarFocoAte('fid', 'aguarda_inspecao', 'resolvido');
    expect(mocks.transicionar).toHaveBeenCalledTimes(4);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(1, 'fid', 'em_inspecao', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(2, 'fid', 'confirmado', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(3, 'fid', 'em_tratamento', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(4, 'fid', 'resolvido', undefined);
  });

  it('motivo só é passado no passo final, não nos intermediários', async () => {
    await avancarFocoAte('fid', 'aguarda_inspecao', 'resolvido', 'meu motivo');
    expect(mocks.transicionar).toHaveBeenNthCalledWith(1, 'fid', 'em_inspecao', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(4, 'fid', 'resolvido', 'meu motivo');
  });

  it('em_triagem → descartado (sem caminho — supervisor não descarta nesse estado): não chama transicionar', async () => {
    await avancarFocoAte('fid', 'em_triagem', 'descartado');
    expect(mocks.transicionar).not.toHaveBeenCalled();
  });

  it('suspeita → resolvido (sem caminho): não chama transicionar', async () => {
    await avancarFocoAte('fid', 'suspeita', 'resolvido');
    expect(mocks.transicionar).not.toHaveBeenCalled();
  });

  it('resolvido → confirmado (sem caminho): não chama transicionar', async () => {
    await avancarFocoAte('fid', 'resolvido', 'confirmado');
    expect(mocks.transicionar).not.toHaveBeenCalled();
  });

  it('confirmado → em_tratamento: chama transicionar uma vez', async () => {
    await avancarFocoAte('fid', 'confirmado', 'em_tratamento');
    expect(mocks.transicionar).toHaveBeenCalledTimes(1);
    expect(mocks.transicionar).toHaveBeenCalledWith('fid', 'em_tratamento', undefined);
  });

  it('aguarda_inspecao → em_tratamento: chama transicionar 3 vezes', async () => {
    await avancarFocoAte('fid', 'aguarda_inspecao', 'em_tratamento');
    expect(mocks.transicionar).toHaveBeenCalledTimes(3);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(1, 'fid', 'em_inspecao', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(2, 'fid', 'confirmado', undefined);
    expect(mocks.transicionar).toHaveBeenNthCalledWith(3, 'fid', 'em_tratamento', undefined);
  });
});
