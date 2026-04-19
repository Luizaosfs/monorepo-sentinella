import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GerarResumoDiario } from '../gerar-resumo-diario';

describe('GerarResumoDiario', () => {
  let useCase: GerarResumoDiario;
  const mockQueryRaw = jest.fn();
  const mockUpsert = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GerarResumoDiario,
        {
          provide: PrismaService,
          useValue: {
            client: {
              $queryRaw: mockQueryRaw,
              resumos_diarios: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: mockUpsert,
                update: mockUpsert,
              },
            },
          },
        },
      ],
    }).compile();

    useCase = module.get<GerarResumoDiario>(GerarResumoDiario);
  });

  it('gera e salva resumo diário via upsert', async () => {
    const metricas = {
      total_vistorias: 10,
      total_focos: 3,
      focos_confirmados: 2,
      focos_resolvidos: 1,
      agentes_ativos: 5,
    };
    const resumoSalvo = { id: 'resumo-1', sumario: 'Resumo do dia ...', metricas };
    mockQueryRaw.mockResolvedValue([metricas]);
    mockUpsert.mockResolvedValue(resumoSalvo);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(resumoSalvo);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cliente_id: 'cliente-uuid' }),
      }),
    );
  });
});
