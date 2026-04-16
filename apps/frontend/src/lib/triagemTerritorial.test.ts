import { describe, it, expect } from 'vitest';
import {
  resolveAgrupador,
  isElegivelParaAtribuicao,
  prioridadeOrdinal,
  ordinalToPrioridade,
  filtrarGrupos,
} from './triagemTerritorial';
import type { FocoRiscoAgrupado } from '@/types/database';

function makeGrupo(overrides: Partial<FocoRiscoAgrupado> = {}): FocoRiscoAgrupado {
  return {
    cliente_id: 'c1',
    agrupador_tipo: 'bairro',
    agrupador_valor: 'Centro',
    quantidade_focos: 5,
    quantidade_elegivel: 3,
    ct_em_triagem: 2,
    ct_aguarda_inspecao: 1,
    ct_sem_responsavel: 2,
    prioridade_max_ord: 2,
    foco_ids: ['f1', 'f2', 'f3', 'f4', 'f5'],
    lat_media: null,
    lng_media: null,
    ...overrides,
  };
}

// ── resolveAgrupador ──────────────────────────────────────────────────────────

describe('resolveAgrupador — hierarquia de agrupamento', () => {
  it('usa quadra quando disponível (nível preferencial)', () => {
    const result = resolveAgrupador({
      id: 'f1',
      quarteirao: '12',
      bairro: 'Centro',
      regiao_nome: 'Norte',
    });
    expect(result).toEqual({ tipo: 'quadra', valor: '12' });
  });

  it('cai para bairro quando quarteirao é null', () => {
    const result = resolveAgrupador({
      id: 'f2',
      quarteirao: null,
      bairro: 'Centro',
      regiao_nome: 'Norte',
    });
    expect(result).toEqual({ tipo: 'bairro', valor: 'Centro' });
  });

  it('cai para bairro quando quarteirao é string vazia', () => {
    const result = resolveAgrupador({
      id: 'f3',
      quarteirao: '',
      bairro: 'Jardim',
      regiao_nome: 'Sul',
    });
    expect(result).toEqual({ tipo: 'bairro', valor: 'Jardim' });
  });

  it('cai para regiao quando quarteirao e bairro são null', () => {
    const result = resolveAgrupador({
      id: 'f4',
      quarteirao: null,
      bairro: null,
      regiao_nome: 'Norte',
    });
    expect(result).toEqual({ tipo: 'regiao', valor: 'Norte' });
  });

  it('cai para regiao quando quarteirao e bairro são string vazia', () => {
    const result = resolveAgrupador({
      id: 'f5',
      quarteirao: '   ',
      bairro: '   ',
      regiao_nome: 'Sul',
    });
    expect(result).toEqual({ tipo: 'regiao', valor: 'Sul' });
  });

  it('fallback para item quando nenhum nível está disponível', () => {
    const result = resolveAgrupador({
      id: 'foco-uuid-123',
      quarteirao: null,
      bairro: null,
      regiao_nome: null,
    });
    expect(result).toEqual({ tipo: 'item', valor: 'foco-uuid-123' });
  });

  it('fallback para item quando todos os campos são string vazia', () => {
    const result = resolveAgrupador({
      id: 'foco-uuid-456',
      quarteirao: '',
      bairro: '',
      regiao_nome: '',
    });
    expect(result).toEqual({ tipo: 'item', valor: 'foco-uuid-456' });
  });

  it('trim whitespace do valor do agrupador', () => {
    const result = resolveAgrupador({ id: 'f6', quarteirao: '  07  ' });
    expect(result).toEqual({ tipo: 'quadra', valor: '07' });
  });
});

// ── isElegivelParaAtribuicao ──────────────────────────────────────────────────

describe('isElegivelParaAtribuicao — elegibilidade de distribuição', () => {
  it('em_triagem é elegível', () => {
    expect(isElegivelParaAtribuicao('em_triagem')).toBe(true);
  });

  it('aguarda_inspecao é elegível (reatribuição)', () => {
    expect(isElegivelParaAtribuicao('aguarda_inspecao')).toBe(true);
  });

  it('em_inspecao NÃO é elegível', () => {
    expect(isElegivelParaAtribuicao('em_inspecao')).toBe(false);
  });

  it('confirmado NÃO é elegível', () => {
    expect(isElegivelParaAtribuicao('confirmado')).toBe(false);
  });

  it('em_tratamento NÃO é elegível', () => {
    expect(isElegivelParaAtribuicao('em_tratamento')).toBe(false);
  });

  it('resolvido NÃO é elegível', () => {
    expect(isElegivelParaAtribuicao('resolvido')).toBe(false);
  });

  it('descartado NÃO é elegível', () => {
    expect(isElegivelParaAtribuicao('descartado')).toBe(false);
  });
});

// ── prioridadeOrdinal ─────────────────────────────────────────────────────────

describe('prioridadeOrdinal — ordenação de prioridade', () => {
  it('P1 tem ordinal 1 (máxima prioridade)', () => {
    expect(prioridadeOrdinal('P1')).toBe(1);
  });

  it('P5 tem ordinal 5 (mínima prioridade)', () => {
    expect(prioridadeOrdinal('P5')).toBe(5);
  });

  it('null retorna 99 (sem prioridade)', () => {
    expect(prioridadeOrdinal(null)).toBe(99);
  });

  it('undefined retorna 99', () => {
    expect(prioridadeOrdinal(undefined)).toBe(99);
  });

  it('P1 < P2 < P3 < P4 < P5 (menor = mais urgente)', () => {
    const ords = ['P1', 'P2', 'P3', 'P4', 'P5'].map(prioridadeOrdinal);
    expect(ords).toEqual([1, 2, 3, 4, 5]);
  });
});

// ── ordinalToPrioridade ───────────────────────────────────────────────────────

describe('ordinalToPrioridade — conversão ordinal → label', () => {
  it('1 → P1', () => {
    expect(ordinalToPrioridade(1)).toBe('P1');
  });

  it('5 → P5', () => {
    expect(ordinalToPrioridade(5)).toBe('P5');
  });

  it('99 → null (sem prioridade)', () => {
    expect(ordinalToPrioridade(99)).toBeNull();
  });

  it('null → null', () => {
    expect(ordinalToPrioridade(null)).toBeNull();
  });
});

// ── filtrarGrupos ─────────────────────────────────────────────────────────────

describe('filtrarGrupos — filtros do modo territorial', () => {
  const grupos: FocoRiscoAgrupado[] = [
    makeGrupo({ agrupador_valor: 'Centro', prioridade_max_ord: 1, quantidade_elegivel: 3, ct_sem_responsavel: 2 }),
    makeGrupo({ agrupador_valor: 'Jardim', prioridade_max_ord: 3, quantidade_elegivel: 2, ct_sem_responsavel: 0 }),
    makeGrupo({ agrupador_valor: 'Norte',  prioridade_max_ord: 5, quantidade_elegivel: 0, ct_sem_responsavel: 1 }),
    makeGrupo({ agrupador_valor: 'Sul',    prioridade_max_ord: null, quantidade_elegivel: 1, ct_sem_responsavel: 0 }),
  ];

  it('sem filtros retorna todos os grupos', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: null, somenteElegiveis: false });
    expect(result).toHaveLength(4);
  });

  it('filtro P1: retorna apenas grupos com prioridade_max_ord <= 1', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: 1, somenteElegiveis: false });
    expect(result).toHaveLength(1);
    expect(result[0].agrupador_valor).toBe('Centro');
  });

  it('filtro P3: retorna grupos com prioridade_max_ord <= 3', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: 3, somenteElegiveis: false });
    const valores = result.map((g) => g.agrupador_valor);
    expect(valores).toContain('Centro');
    expect(valores).toContain('Jardim');
    expect(valores).not.toContain('Norte'); // P5 = 5 > 3
    expect(valores).not.toContain('Sul');   // null → 99 > 3
  });

  it('somenteElegiveis: exclui grupos com quantidade_elegivel = 0', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: null, somenteElegiveis: true });
    expect(result.every((g) => g.quantidade_elegivel > 0)).toBe(true);
    expect(result.find((g) => g.agrupador_valor === 'Norte')).toBeUndefined();
  });

  it('filtros combinados: P3 + somenteElegiveis', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: 3, somenteElegiveis: true });
    const valores = result.map((g) => g.agrupador_valor);
    expect(valores).toContain('Centro');
    expect(valores).toContain('Jardim');
    expect(valores).not.toContain('Norte');
    expect(valores).not.toContain('Sul');
  });

  it('grupos sem prioridade (null) tratados como ordinal 99 — excluídos por filtro de prioridade', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: 5, somenteElegiveis: false });
    expect(result.find((g) => g.agrupador_valor === 'Sul')).toBeUndefined();
  });

  it('somentesSemResponsavel: retorna apenas grupos com ct_sem_responsavel > 0', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: null, somenteElegiveis: false, somentesSemResponsavel: true });
    const valores = result.map((g) => g.agrupador_valor);
    expect(valores).toContain('Centro'); // ct_sem_responsavel=2
    expect(valores).toContain('Norte');  // ct_sem_responsavel=1
    expect(valores).not.toContain('Jardim'); // ct_sem_responsavel=0
    expect(valores).not.toContain('Sul');    // ct_sem_responsavel=0
  });

  it('somentesSemResponsavel=false não filtra nada extra', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: null, somenteElegiveis: false, somentesSemResponsavel: false });
    expect(result).toHaveLength(4);
  });

  it('filtros combinados: P3 + somentesSemResponsavel', () => {
    const result = filtrarGrupos(grupos, { prioridadeMaxOrd: 3, somenteElegiveis: false, somentesSemResponsavel: true });
    const valores = result.map((g) => g.agrupador_valor);
    expect(valores).toContain('Centro'); // P1, ct_sem_responsavel=2 ✓
    expect(valores).not.toContain('Jardim'); // P3, mas ct_sem_responsavel=0
    expect(valores).not.toContain('Norte');  // P5 > 3
    expect(valores).not.toContain('Sul');    // null>99 > 3
  });
});
