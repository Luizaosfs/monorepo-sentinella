import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FocoRiscoAtivo } from '@/types/database';
import {
  DEFAULT_GESTOR_MAPA_FILTERS,
  countGestorMapaFilterSelections,
  filterFocosForGestorMapa,
  computeGestorMapaFocoStats,
  type GestorMapaFocoFilterState,
} from './gestorMapaFocoFilters';

function foco(over: Partial<FocoRiscoAtivo> = {}): FocoRiscoAtivo {
  return {
    id: 'f1',
    cliente_id: 'c1',
    imovel_id: 'i1',
    regiao_id: 'r1',
    origem_tipo: 'drone',
    origem_levantamento_item_id: null,
    origem_vistoria_id: null,
    status: 'confirmado',
    prioridade: 'P3',
    ciclo: 1,
    latitude: null,
    longitude: null,
    endereco_normalizado: null,
    suspeita_em: new Date().toISOString(),
    confirmado_em: null,
    resolvido_em: null,
    responsavel_id: null,
    desfecho: null,
    foco_anterior_id: null,
    casos_ids: [],
    created_at: '',
    updated_at: '',
    logradouro: null,
    numero: null,
    bairro: null,
    quarteirao: null,
    tipo_imovel: null,
    regiao_nome: null,
    responsavel_nome: null,
    sla_prazo_em: null,
    sla_violado: null,
    sla_status: 'ok',
    origem_image_url: null,
    origem_item: null,
    ...over,
  };
}

describe('DEFAULT_GESTOR_MAPA_FILTERS', () => {
  it('inicia sem filtros ativos além de defaults', () => {
    expect(DEFAULT_GESTOR_MAPA_FILTERS.regiaoId).toBe('all');
    expect(DEFAULT_GESTOR_MAPA_FILTERS.periodo).toBe('all');
    expect(DEFAULT_GESTOR_MAPA_FILTERS.status).toEqual([]);
  });
});

describe('countGestorMapaFilterSelections', () => {
  it('conta região, período e arrays', () => {
    const f: GestorMapaFocoFilterState = {
      ...DEFAULT_GESTOR_MAPA_FILTERS,
      regiaoId: 'rid',
      periodo: '7d',
      status: ['confirmado'],
      prioridade: ['P1', 'P2'],
      origem: ['drone'],
      slaStatus: ['critico'],
      scoreClassificacao: ['alto'],
    };
    // regiao + periodo + 1 status + 2 prioridades + 1 origem + 1 sla + 1 score = 8
    expect(countGestorMapaFilterSelections(f)).toBe(8);
  });
});

describe('filterFocosForGestorMapa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T14:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filtra por regiaoId', () => {
    const list = [foco({ id: 'a', regiao_id: 'r1' }), foco({ id: 'b', regiao_id: 'r2' })];
    const out = filterFocosForGestorMapa(list, {
      ...DEFAULT_GESTOR_MAPA_FILTERS,
      regiaoId: 'r1',
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('periodo hoje mantém apenas suspeita_em do dia local', () => {
    const hoje = new Date('2025-06-15T10:00:00.000Z').toISOString();
    const ontem = new Date('2025-06-14T10:00:00.000Z').toISOString();
    const list = [foco({ id: 'h', suspeita_em: hoje }), foco({ id: 'o', suspeita_em: ontem })];
    const out = filterFocosForGestorMapa(list, {
      ...DEFAULT_GESTOR_MAPA_FILTERS,
      periodo: 'hoje',
    });
    expect(out.map((x) => x.id)).toContain('h');
    expect(out.map((x) => x.id)).not.toContain('o');
  });

  it('filtra por status e prioridade', () => {
    const list = [
      foco({ id: '1', status: 'confirmado', prioridade: 'P1' }),
      foco({ id: '2', status: 'suspeita', prioridade: 'P1' }),
    ];
    const out = filterFocosForGestorMapa(list, {
      ...DEFAULT_GESTOR_MAPA_FILTERS,
      status: ['confirmado'],
      prioridade: ['P1'],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('filtra por origem e sla_status', () => {
    const list = [
      foco({ id: 'x', origem_tipo: 'drone', sla_status: 'critico' }),
      foco({ id: 'y', origem_tipo: 'cidadao', sla_status: 'ok' }),
    ];
    const out = filterFocosForGestorMapa(list, {
      ...DEFAULT_GESTOR_MAPA_FILTERS,
      origem: ['drone'],
      slaStatus: ['critico'],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('x');
  });
});

describe('computeGestorMapaFocoStats', () => {
  it('agrega totais e SLA em risco', () => {
    const list = [
      foco({ prioridade: 'P1', regiao_id: 'a', sla_status: 'critico' }),
      foco({ prioridade: 'P2', regiao_id: 'b', sla_status: 'ok' }),
      foco({ prioridade: 'P3', regiao_id: 'a', sla_status: 'vencido' }),
    ];
    const s = computeGestorMapaFocoStats(list);
    expect(s.total).toBe(3);
    expect(s.urgentesP1P2).toBe(2);
    expect(s.regioesDistintas).toBe(2);
    expect(s.slaEmRisco).toBe(2);
  });
});
