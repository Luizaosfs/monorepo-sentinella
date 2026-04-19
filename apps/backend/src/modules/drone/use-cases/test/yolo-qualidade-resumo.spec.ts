import { YoloQualidadeResumo } from '../yolo-qualidade-resumo';

describe('YoloQualidadeResumo', () => {
  let uc: YoloQualidadeResumo;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    uc = new YoloQualidadeResumo({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns zero stats when no correlacoes', async () => {
    const result = await uc.execute('cli-1');
    expect(result.total_correlacoes).toBe(0);
    expect(result.precisao_estimada).toBe(0);
    expect(result.correlacoes).toEqual([]);
    expect(result.evolucao_mensal).toEqual([]);
  });

  it('computes precisao_estimada correctly', async () => {
    queryRaw.mockResolvedValue([
      { id: '1', distancia_metros: 10, drone_detectou_foco: true,  campo_confirmou_foco: true,  levantamento_item_id: 'i1', endereco_curto: 'Rua A', risco: 'alto' },
      { id: '2', distancia_metros: 20, drone_detectou_foco: true,  campo_confirmou_foco: false, levantamento_item_id: 'i2', endereco_curto: 'Rua B', risco: 'medio' },
      { id: '3', distancia_metros: 5,  drone_detectou_foco: false, campo_confirmou_foco: null,  levantamento_item_id: 'i3', endereco_curto: null,    risco: null },
    ]);
    const result = await uc.execute('cli-1');
    expect(result.total_correlacoes).toBe(3);
    expect(result.precisao_estimada).toBe(50);    // 1/2 com confirmação
    expect(result.taxa_falsos_positivos).toBe(50);
  });

  it('maps correlacoes with fallback endereco and risco', async () => {
    queryRaw.mockResolvedValue([
      { id: 'x', distancia_metros: 3, drone_detectou_foco: true, campo_confirmou_foco: null, levantamento_item_id: 'i1', endereco_curto: null, risco: null },
    ]);
    const result = await uc.execute('cli-1');
    expect(result.correlacoes[0].endereco).toBe('—');
    expect(result.correlacoes[0].risco_drone).toBe('—');
  });
});
