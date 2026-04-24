import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { EnfileirarScoreImovel } from '../enfileirar-score-imovel';

describe('EnfileirarScoreImovel', () => {
  let service: EnfileirarScoreImovel;
  const mockCreate = jest.fn();
  const prismaMock = { client: { job_queue: { create: mockCreate } } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnfileirarScoreImovel,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<EnfileirarScoreImovel>(EnfileirarScoreImovel);
  });

  it('enfileirarPorImovel chama job_queue.create com tipo e payload camelCase corretos', async () => {
    mockCreate.mockResolvedValue({});
    await service.enfileirarPorImovel('imovel-uuid-1', 'cliente-uuid-1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tipo: 'recalcular_score_imovel',
        status: 'pendente',
        payload: { imovelId: 'imovel-uuid-1', clienteId: 'cliente-uuid-1' },
      },
    });
  });

  it('enfileirarPorCaso chama job_queue.create com tipo e payload camelCase corretos', async () => {
    mockCreate.mockResolvedValue({});
    await service.enfileirarPorCaso('caso-uuid-1', 'cliente-uuid-1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tipo: 'recalcular_score_por_caso',
        status: 'pendente',
        payload: { casoId: 'caso-uuid-1', clienteId: 'cliente-uuid-1' },
      },
    });
  });

  it('payload de enfileirarPorCaso NÃO contém raio_m', async () => {
    mockCreate.mockResolvedValue({});
    await service.enfileirarPorCaso('caso-uuid-1', 'cliente-uuid-1');
    expect(mockCreate.mock.calls[0][0].data.payload).not.toHaveProperty('raio_m');
  });

  it('erro do Prisma em enfileirarPorImovel propaga para o caller', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(service.enfileirarPorImovel('imovel-uuid-1', 'cliente-uuid-1')).rejects.toThrow('DB error');
  });

  it('erro do Prisma em enfileirarPorCaso propaga para o caller', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(service.enfileirarPorCaso('caso-uuid-1', 'cliente-uuid-1')).rejects.toThrow('DB error');
  });

  it('service não silencia erros — rejeição chega ao caller intacta', async () => {
    mockCreate.mockRejectedValue(new Error('falha silenciosa'));
    await expect(service.enfileirarPorImovel('x', 'y')).rejects.toThrow('falha silenciosa');
  });
});
