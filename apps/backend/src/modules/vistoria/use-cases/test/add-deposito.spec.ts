import { AddDeposito } from '../add-deposito';

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockPrisma = {
  client: {
    vistorias: { findFirst: mockFindFirst },
    vistoria_depositos: { create: mockCreate },
  },
} as any;

const baseInput = {
  tipo: 'A1',
  qtdInspecionados: 2,
  qtdComFocos: 1,
  qtdEliminados: 1,
  usouLarvicida: false,
  qtdLarvicidaG: null,
  qtdComAgua: 1,
  eliminado: false,
  vedado: false,
  iaIdentificacao: null,
};

describe('AddDeposito', () => {
  let useCase: AddDeposito;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new AddDeposito(mockPrisma);
    mockFindFirst.mockResolvedValue({ id: 'v-1' });
  });

  it('deve criar depósito com campos corretos', async () => {
    const dbRow = { id: 'dep-1', vistoria_id: 'v-1', cliente_id: 'c-1', tipo: 'A1' };
    mockCreate.mockResolvedValue(dbRow);

    const result = await useCase.execute('v-1', 'c-1', baseInput);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'v-1', cliente_id: 'c-1', deleted_at: null },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vistoria_id:       'v-1',
        cliente_id:        'c-1',
        tipo:              'A1',
        qtd_inspecionados: 2,
        qtd_com_focos:     1,
        qtd_eliminados:    1,
        usou_larvicida:    false,
        qtd_com_agua:      1,
        eliminado:         false,
        vedado:            false,
      }),
    });
    expect(result.deposito).toEqual(dbRow);
  });

  it('deve lançar notFound quando vistoria não pertence ao tenant', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(useCase.execute('v-outro-tenant', 'c-1', baseInput)).rejects.toThrow();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('deve propagar erro do Prisma', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute('v-1', 'c-1', baseInput)).rejects.toThrow('DB error');
  });
});
