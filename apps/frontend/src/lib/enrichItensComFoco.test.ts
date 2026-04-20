import { describe, it, expect } from 'vitest';
import { mapFocoStatusToAtendimento, enrichItensComFoco } from './enrichItensComFoco';

describe('mapFocoStatusToAtendimento', () => {
  it('retorna "resolvido" para status resolvido', () => {
    expect(mapFocoStatusToAtendimento('resolvido')).toBe('resolvido');
  });

  it('retorna "resolvido" para status descartado', () => {
    expect(mapFocoStatusToAtendimento('descartado')).toBe('resolvido');
  });

  it('retorna "resolvido" para status cancelado', () => {
    expect(mapFocoStatusToAtendimento('cancelado')).toBe('resolvido');
  });

  it('retorna "pendente" para em_triagem (supervisor ainda não confirmou)', () => {
    expect(mapFocoStatusToAtendimento('em_triagem')).toBe('pendente');
  });

  it('retorna "em_atendimento" para em_tratamento', () => {
    expect(mapFocoStatusToAtendimento('em_tratamento')).toBe('em_atendimento');
  });

  it('retorna "em_atendimento" para confirmado', () => {
    expect(mapFocoStatusToAtendimento('confirmado')).toBe('em_atendimento');
  });

  it('retorna "pendente" para suspeita', () => {
    expect(mapFocoStatusToAtendimento('suspeita')).toBe('pendente');
  });

  it('retorna "pendente" para null', () => {
    expect(mapFocoStatusToAtendimento(null)).toBe('pendente');
  });

  it('retorna "pendente" para undefined', () => {
    expect(mapFocoStatusToAtendimento(undefined)).toBe('pendente');
  });

  it('é case-insensitive (RESOLVIDO)', () => {
    expect(mapFocoStatusToAtendimento('RESOLVIDO')).toBe('resolvido');
  });

  // Estados do domínio não cobertos anteriormente
  it('retorna "pendente" para aguarda_inspecao (foco ainda não inspecionado)', () => {
    expect(mapFocoStatusToAtendimento('aguarda_inspecao')).toBe('pendente');
  });

  it('retorna "em_atendimento" para em_inspecao (agente ativamente inspecionando)', () => {
    expect(mapFocoStatusToAtendimento('em_inspecao')).toBe('em_atendimento');
  });

  it('retorna "pendente" para string vazia', () => {
    expect(mapFocoStatusToAtendimento('')).toBe('pendente');
  });

  it('retorna "pendente" para valor desconhecido arbitrário', () => {
    expect(mapFocoStatusToAtendimento('status_inventado')).toBe('pendente');
  });

  it('é case-insensitive (EM_TRIAGEM)', () => {
    expect(mapFocoStatusToAtendimento('EM_TRIAGEM')).toBe('pendente');
  });

  it('é case-insensitive (DESCARTADO)', () => {
    expect(mapFocoStatusToAtendimento('DESCARTADO')).toBe('resolvido');
  });
});

describe('enrichItensComFoco', () => {
  it('injeta foco_risco_id, foco_risco_status e status_atendimento quando foco está presente', () => {
    const rows = [
      {
        id: 'item-1',
        cliente_id: 'cliente-1',
        foco: { id: 'foco-1', status: 'confirmado', desfecho: null, resolvido_em: null },
      },
    ];

    const result = enrichItensComFoco(rows as never);
    expect(result[0].foco_risco_id).toBe('foco-1');
    expect(result[0].foco_risco_status).toBe('confirmado');
    expect(result[0].status_atendimento).toBe('em_atendimento');
    expect(result[0].acao_aplicada).toBeNull();
    expect(result[0].data_resolucao).toBeNull();
  });

  it('define status_atendimento=pendente quando foco é null', () => {
    const rows = [{ id: 'item-2', cliente_id: 'cliente-1', foco: null }];
    const result = enrichItensComFoco(rows as never);
    expect(result[0].foco_risco_id).toBeNull();
    expect(result[0].foco_risco_status).toBeNull();
    expect(result[0].status_atendimento).toBe('pendente');
  });

  it('suporta foco como array (join Supabase retorna array)', () => {
    const rows = [
      {
        id: 'item-3',
        foco: [{ id: 'foco-3', status: 'resolvido', desfecho: 'Tratamento concluído', resolvido_em: '2026-03-01' }],
      },
    ];
    const result = enrichItensComFoco(rows as never);
    expect(result[0].foco_risco_id).toBe('foco-3');
    expect(result[0].status_atendimento).toBe('resolvido');
    expect(result[0].acao_aplicada).toBe('Tratamento concluído');
    expect(result[0].data_resolucao).toBe('2026-03-01');
  });

  it('suporta foco como array vazio', () => {
    const rows = [{ id: 'item-4', foco: [] }];
    const result = enrichItensComFoco(rows as never);
    expect(result[0].foco_risco_id).toBeNull();
    expect(result[0].status_atendimento).toBe('pendente');
  });

  it('preserva demais campos do row original', () => {
    const rows = [
      {
        id: 'item-5',
        cliente_id: 'cliente-x',
        score_yolo: 0.87,
        foco: null,
      },
    ];
    const result = enrichItensComFoco(rows as never);
    expect((result[0] as Record<string, unknown>).score_yolo).toBe(0.87);
    expect((result[0] as Record<string, unknown>).cliente_id).toBe('cliente-x');
  });

  it('processa múltiplas rows corretamente', () => {
    const rows = [
      { id: 'a', foco: { id: 'f-a', status: 'suspeita', desfecho: null, resolvido_em: null } },
      { id: 'b', foco: { id: 'f-b', status: 'em_tratamento', desfecho: null, resolvido_em: null } },
      { id: 'c', foco: null },
    ];
    const result = enrichItensComFoco(rows as never);
    expect(result[0].status_atendimento).toBe('pendente');
    expect(result[1].status_atendimento).toBe('em_atendimento');
    expect(result[2].status_atendimento).toBe('pendente');
  });
});
