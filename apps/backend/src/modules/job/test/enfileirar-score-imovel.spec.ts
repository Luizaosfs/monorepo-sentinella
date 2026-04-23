import { Test, TestingModule } from '@nestjs/testing';

import { EnfileirarScoreImovel } from '../enfileirar-score-imovel';

const mockJobQueue = { create: jest.fn() };
const prismaMock = { client: { job_queue: mockJobQueue } };

describe('EnfileirarScoreImovel', () => {
  let service: EnfileirarScoreImovel;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnfileirarScoreImovel,
        { provide: 'PrismaService', useValue: prismaMock },
      ],
    })
      .overrideProvider(EnfileirarScoreImovel)
      .useFactory({ factory: () => new EnfileirarScoreImovel(prismaMock as any) })
      .compile();

    service = new EnfileirarScoreImovel(prismaMock as any);
  });

  it('enfileirarPorImovel cria job recalcular_score_imovel com payload camelCase', async () => {
    mockJobQueue.create.mockResolvedValue({ id: 'job-1' });

    await service.enfileirarPorImovel('imovel-uuid', 'cliente-uuid');

    expect(mockJobQueue.create).toHaveBeenCalledWith({
      data: {
        tipo: 'recalcular_score_imovel',
        payload: { imovelId: 'imovel-uuid', clienteId: 'cliente-uuid' },
      },
    });
  });

  it('enfileirarPorCaso cria job recalcular_score_por_caso com payload camelCase', async () => {
    mockJobQueue.create.mockResolvedValue({ id: 'job-2' });

    await service.enfileirarPorCaso('caso-uuid', 'cliente-uuid');

    expect(mockJobQueue.create).toHaveBeenCalledWith({
      data: {
        tipo: 'recalcular_score_por_caso',
        payload: { casoId: 'caso-uuid', clienteId: 'cliente-uuid' },
      },
    });
  });

  it('enfileirarPorImovel engole erro de DB sem lançar', async () => {
    mockJobQueue.create.mockRejectedValue(new Error('DB timeout'));

    await expect(service.enfileirarPorImovel('x', 'y')).resolves.toBeUndefined();
  });

  it('enfileirarPorCaso engole erro de DB sem lançar', async () => {
    mockJobQueue.create.mockRejectedValue(new Error('DB timeout'));

    await expect(service.enfileirarPorCaso('x', 'y')).resolves.toBeUndefined();
  });
});
