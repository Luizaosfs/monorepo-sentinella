import { FocoRisco } from '../../entities/foco-risco';
import {
  buildFocoSlaSnapshot,
  mapFocoStatusParaFaseSla,
  resolverEntradaEstadoAtual,
} from '../foco-sla-snapshot';

describe('foco-sla-snapshot', () => {
  const baseFoco = () =>
    new FocoRisco(
      {
        clienteId: 'c1',
        origemTipo: 'x',
        status: 'em_triagem',
        classificacaoInicial: 'suspeito',
        scorePrioridade: 0,
        suspeitaEm: new Date('2024-01-01T10:00:00Z'),
        casosIds: [],
      },
      { id: 'f1', createdAt: new Date(), updatedAt: new Date() },
    );

  it('mapeia status operacional para fase de config (sla_foco_config)', () => {
    expect(mapFocoStatusParaFaseSla('suspeita')).toBe('triagem');
    expect(mapFocoStatusParaFaseSla('em_inspecao')).toBe('inspecao');
    expect(mapFocoStatusParaFaseSla('confirmado')).toBe('confirmacao');
    expect(mapFocoStatusParaFaseSla('resolvido')).toBeNull();
  });

  it('resolve entrada no estado pelo último histórico com statusNovo atual', () => {
    const foco = baseFoco();
    (foco as unknown as { props: { historico: unknown[] } }).props.historico = [
      {
        clienteId: 'c1',
        statusNovo: 'suspeita',
        alteradoEm: new Date('2024-01-01T10:00:00Z'),
      },
      {
        clienteId: 'c1',
        statusNovo: 'em_triagem',
        alteradoEm: new Date('2024-01-02T12:00:00Z'),
      },
    ];
    expect(resolverEntradaEstadoAtual(foco).toISOString()).toBe(
      '2024-01-02T12:00:00.000Z',
    );
  });

  it('buildFocoSlaSnapshot usa prazo da fase e marca vencido ao atingir 100%', () => {
    const foco = baseFoco();
    (foco as unknown as { props: { historico: unknown[] } }).props.historico = [
      {
        clienteId: 'c1',
        statusNovo: 'em_triagem',
        alteradoEm: new Date('2024-01-01T10:00:00Z'),
      },
    ];
    const agora = new Date('2024-01-01T11:00:00Z'); // 60 min depois
    const snap = buildFocoSlaSnapshot({
      foco,
      agora,
      prazoFaseMinutos: 60,
      slaOperacional: null,
    });
    expect(snap.percentualConsumidoFase).toBe(100);
    expect(snap.statusSla).toBe('vencido');
  });

  it('prioriza violação / prazo final de sla_operacional', () => {
    const foco = baseFoco();
    const agora = new Date('2025-06-01T12:00:00Z');
    const snap = buildFocoSlaSnapshot({
      foco,
      agora,
      prazoFaseMinutos: 9999,
      slaOperacional: {
        id: 'sla-1',
        inicio: new Date('2025-06-01T08:00:00Z'),
        prazo_final: new Date('2025-06-01T10:00:00Z'),
        violado: false,
        status: 'pendente',
      },
    });
    expect(snap.statusSla).toBe('vencido');
    expect(snap.operacional?.id).toBe('sla-1');
  });
});
