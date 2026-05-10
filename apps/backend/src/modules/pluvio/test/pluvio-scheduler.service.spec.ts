import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PluvioSchedulerService } from '../pluvio-scheduler.service';

const mockUpsert = jest.fn().mockResolvedValue({});

function buildPrismaMock(
  clientes: { id: string }[],
  regioesPorCliente: Record<string, { id: string; latitude: number | null; longitude: number | null }[]>,
) {
  return {
    client: {
      clientes: {
        findMany: jest.fn().mockResolvedValue(clientes),
      },
      bairros: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(regioesPorCliente[where.cliente_id] ?? []),
        ),
      },
      pluvio_risco: { upsert: mockUpsert },
    },
  } as any;
}

describe('PluvioSchedulerService.riscoDaily', () => {
  let service: PluvioSchedulerService;

  afterEach(() => jest.restoreAllMocks());

  async function build(prismaMock: any) {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluvioSchedulerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    return module.get<PluvioSchedulerService>(PluvioSchedulerService);
  }

  it('contabiliza regiões sem coordenadas em puladas', async () => {
    const prismaMock = buildPrismaMock(
      [{ id: 'c1' }],
      { c1: [{ id: 'r1', latitude: null, longitude: null }] },
    );
    service = await build(prismaMock);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ daily: { precipitation_sum: [], temperature_2m_max: [], wind_speed_10m_max: [] } }) } as any);

    const result = await service.riscoDaily();

    expect(result.puladas).toBe(1);
    expect(result.regioes).toBe(0);
    expect(result.atualizadas).toBe(0);
  });

  it('contabiliza erros quando fetch retorna !ok', async () => {
    const prismaMock = buildPrismaMock(
      [{ id: 'c1' }],
      { c1: [{ id: 'r1', latitude: -20, longitude: -43 }] },
    );
    service = await build(prismaMock);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as any);

    const result = await service.riscoDaily();

    expect(result.erros).toBe(1);
    expect(result.atualizadas).toBe(0);
  });

  it('contabiliza erros quando fetch lança exceção e continua outras regiões', async () => {
    const prismaMock = buildPrismaMock(
      [{ id: 'c1' }],
      {
        c1: [
          { id: 'r1', latitude: -20, longitude: -43 },
          { id: 'r2', latitude: -21, longitude: -44 },
        ],
      },
    );
    service = await build(prismaMock);

    const okResponse = {
      ok: true,
      json: async () => ({
        daily: {
          precipitation_sum: [0, 0, 0, 0, 0, 0, 0, 5, 3],
          temperature_2m_max: [],
          wind_speed_10m_max: [],
        },
      }),
    } as any;

    jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(okResponse);

    const result = await service.riscoDaily();

    expect(result.erros).toBe(1);
    expect(result.atualizadas).toBe(1);
    expect(result.regioes).toBe(2);
  });

  it('retorna regioes=0 e atualizadas=0 quando não há clientes', async () => {
    const prismaMock = buildPrismaMock([], {});
    service = await build(prismaMock);

    const result = await service.riscoDaily();

    expect(result).toEqual({ regioes: 0, atualizadas: 0, erros: 0, puladas: 0 });
  });
});
