import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';
import { CruzarFocoConfirmadoComCasos } from '../cruzar-foco-confirmado-com-casos';

describe('CruzarFocoNovoComCasos (adaptador legado → delega ao canônico)', () => {
  let uc: CruzarFocoNovoComCasos;
  let canonical: { execute: jest.Mock };

  beforeEach(() => {
    canonical = { execute: jest.fn().mockResolvedValue({ cruzamentos: 2, casos: 3 }) };
    uc = new CruzarFocoNovoComCasos(
      canonical as unknown as CruzarFocoConfirmadoComCasos,
    );
  });

  it('delega ao canônico mapeando focoId/clienteId/lat/lng (sem repassar levantamentoItemId)', async () => {
    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: 'li1',
      latitude: -23.5,
      longitude: -46.6,
    });

    expect(canonical.execute).toHaveBeenCalledWith({
      focoId: 'f1',
      clienteId: 'cli1',
      latitude: -23.5,
      longitude: -46.6,
    });
    // não vaza `casos`; preserva o contrato histórico { cruzamentos }
    expect(r).toEqual({ cruzamentos: 2 });
  });

  it('não bloqueia mais por ausência de origemLevantamentoItemId (gap legado removido)', async () => {
    await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: null,
      latitude: -23.5,
      longitude: -46.6,
    });

    expect(canonical.execute).toHaveBeenCalledTimes(1);
  });
});
