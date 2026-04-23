import { AddSintomas } from '../add-sintomas';

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockPrisma = {
  client: {
    vistorias: { findFirst: mockFindFirst },
    vistoria_sintomas: { create: mockCreate },
  },
} as any;

const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) } as any;

const baseInput = {
  vistoriaId:           'vistoria-uuid-1',
  febre:                true,
  manchasVermelhas:     false,
  dorArticulacoes:      false,
  dorCabeca:            true,
  moradoresSintomasQtd: 2,
};

describe('AddSintomas', () => {
  let useCase: AddSintomas;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AddSintomas(mockPrisma, mockConsolidar);
    mockFindFirst.mockResolvedValue({ id: 'vistoria-uuid-1' });
  });

  it('deve criar sintoma com clienteId do tenant (MT-02)', async () => {
    const dbRow = { id: 'sint-1', vistoria_id: 'vistoria-uuid-1', cliente_id: 'c-1' };
    mockCreate.mockResolvedValue(dbRow);

    const result = await useCase.execute('c-1', baseInput);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'vistoria-uuid-1', cliente_id: 'c-1', deleted_at: null },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vistoria_id:            'vistoria-uuid-1',
        cliente_id:             'c-1',
        febre:                  true,
        manchas_vermelhas:      false,
        dor_articulacoes:       false,
        dor_cabeca:             true,
        moradores_sintomas_qtd: 2,
      }),
    });
    expect(result.sintoma).toEqual(dbRow);
  });

  it('deve lançar notFound quando vistoria não pertence ao tenant', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(useCase.execute('c-1', baseInput)).rejects.toThrow();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('deve propagar erro do Prisma', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute('c-1', baseInput)).rejects.toThrow('DB error');
  });

  it('invoca hook ConsolidarVistoria após criar sintoma', async () => {
    mockCreate.mockResolvedValue({ id: 'sint-1' });

    await useCase.execute('c-1', baseInput);

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: 'vistoria-uuid-1',
      motivo: 'automático — INSERT em vistoria_sintomas',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar criação do sintoma', async () => {
    const dbRow = { id: 'sint-1' };
    mockCreate.mockResolvedValue(dbRow);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('consolidar boom'));

    const result = await useCase.execute('c-1', baseInput);

    expect(result.sintoma).toEqual(dbRow);
  });
});
