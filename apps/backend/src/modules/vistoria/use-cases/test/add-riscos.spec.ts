import { AddRiscos } from '../add-riscos';

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockPrisma = {
  client: {
    vistorias: { findFirst: mockFindFirst },
    vistoria_riscos: { create: mockCreate },
  },
} as any;

const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) } as any;

const baseInput = {
  vistoriaId:              'vistoria-uuid-1',
  menorIncapaz:            false,
  idosoIncapaz:            true,
  depQuimico:              false,
  riscoAlimentar:          false,
  riscoMoradia:            true,
  criadouroAnimais:        false,
  lixo:                    false,
  residuosOrganicos:       false,
  residuosQuimicos:        false,
  residuosMedicos:         false,
  acumuloMaterialOrganico: false,
  animaisSinaisLv:         false,
  caixaDestampada:         false,
  outroRiscoVetorial:      null,
};

describe('AddRiscos', () => {
  let useCase: AddRiscos;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AddRiscos(mockPrisma, mockConsolidar);
    mockFindFirst.mockResolvedValue({ id: 'vistoria-uuid-1' });
  });

  it('deve criar risco com clienteId do tenant (MT-02)', async () => {
    const dbRow = { id: 'risco-1', vistoria_id: 'vistoria-uuid-1', cliente_id: 'c-1' };
    mockCreate.mockResolvedValue(dbRow);

    const result = await useCase.execute('c-1', baseInput);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'vistoria-uuid-1', cliente_id: 'c-1', deleted_at: null },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vistoria_id:               'vistoria-uuid-1',
        cliente_id:                'c-1',
        menor_incapaz:             false,
        idoso_incapaz:             true,
        risco_moradia:             true,
        outro_risco_vetorial:      null,
      }),
    });
    expect(result.risco).toEqual(dbRow);
  });

  it('deve lançar notFound quando vistoria não pertence ao tenant', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(useCase.execute('c-1', baseInput)).rejects.toThrow();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('deve propagar erro do Prisma', async () => {
    mockCreate.mockRejectedValue(new Error('constraint violation'));

    await expect(useCase.execute('c-1', baseInput)).rejects.toThrow('constraint violation');
  });

  it('invoca hook ConsolidarVistoria após criar risco', async () => {
    mockCreate.mockResolvedValue({ id: 'risco-1' });

    await useCase.execute('c-1', baseInput);

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: 'vistoria-uuid-1',
      motivo: 'automático — INSERT em vistoria_riscos',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar criação do risco', async () => {
    const dbRow = { id: 'risco-1' };
    mockCreate.mockResolvedValue(dbRow);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await useCase.execute('c-1', baseInput);

    expect(result.risco).toEqual(dbRow);
  });
});
