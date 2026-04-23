import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { ConsolidarVistoria } from '../../use-cases/consolidar-vistoria';
import { BackfillConsolidacaoService } from '../backfill-consolidacao.service';

const makeVistorias = (ids: string[]) => ids.map((id) => ({ id }));

function buildPrismaMock(ids: string[], total?: number) {
  const mockClient = {
    vistorias: {
      count: jest.fn().mockResolvedValue(total ?? ids.length),
      findMany: jest.fn().mockResolvedValue(makeVistorias(ids)),
    },
  };
  return {
    client: mockClient,
  } as unknown as PrismaService;
}

describe('BackfillConsolidacaoService', () => {
  let service: BackfillConsolidacaoService;
  let mockConsolidar: { execute: jest.Mock };
  let mockPrisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = buildPrismaMock(
      ['id-1', 'id-2', 'id-3'],
      3,
    );

    // Segundo findMany retorna vazio para terminar o loop
    (mockPrisma.client.vistorias.findMany as jest.Mock)
      .mockResolvedValueOnce(makeVistorias(['id-1', 'id-2', 'id-3']))
      .mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillConsolidacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
      ],
    }).compile();

    service = module.get(BackfillConsolidacaoService);
  });

  it('dryRun=true retorna total>0 e NÃO chama execute', async () => {
    const result = await service.executar({ dryRun: true });

    expect(result.total).toBe(3);
    expect(result.processadas).toBe(0);
    expect(result.ok).toBe(0);
    expect(mockConsolidar.execute).not.toHaveBeenCalled();
  });

  it('processa todas as candidatas chamando execute() por vistoria', async () => {
    const result = await service.executar({ loteSize: 10 });

    expect(result.ok).toBe(3);
    expect(result.erros).toBe(0);
    expect(result.processadas).toBe(3);
    expect(mockConsolidar.execute).toHaveBeenCalledTimes(3);
  });

  it('erro em uma vistoria não interrompe o processamento das demais', async () => {
    mockConsolidar.execute
      .mockRejectedValueOnce(new Error('falha proposital'))
      .mockResolvedValue(undefined);

    const result = await service.executar({ loteSize: 10 });

    expect(result.ok).toBe(2);
    expect(result.erros).toBe(1);
    expect(result.processadas).toBe(3);
  });

  it('errosDetalhe contém vistoriaId e mensagem do erro', async () => {
    mockConsolidar.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await service.executar();

    expect(result.errosDetalhe).toHaveLength(1);
    expect(result.errosDetalhe[0].vistoriaId).toBe('id-1');
    expect(result.errosDetalhe[0].erro).toBe('boom');
  });

  it('termina corretamente quando candidatas.length < loteSize (última página)', async () => {
    jest.clearAllMocks();
    mockConsolidar.execute.mockResolvedValue(undefined);

    const smallPrisma = buildPrismaMock(['id-a', 'id-b'], 2);
    (smallPrisma.client.vistorias.findMany as jest.Mock)
      .mockResolvedValueOnce(makeVistorias(['id-a', 'id-b']))
      .mockResolvedValue([]);
    (smallPrisma.client.vistorias.count as jest.Mock).mockResolvedValue(2);

    const module = await Test.createTestingModule({
      providers: [
        BackfillConsolidacaoService,
        { provide: PrismaService, useValue: smallPrisma },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
      ],
    }).compile();
    const svc = module.get(BackfillConsolidacaoService);

    const result = await svc.executar({ loteSize: 10 });

    expect(result.ok).toBe(2);
    expect(result.processadas).toBe(2);
  });

  it('respeita limite quando fornecido', async () => {
    jest.clearAllMocks();
    mockConsolidar.execute.mockResolvedValue(undefined);

    // Simula muitas vistorias: primeiro lote retorna 2, loop deve parar por limite=2
    const limitePrisma = buildPrismaMock([], 10);
    (limitePrisma.client.vistorias.findMany as jest.Mock)
      .mockResolvedValueOnce(makeVistorias(['id-x', 'id-y']))
      .mockResolvedValue([]);
    (limitePrisma.client.vistorias.count as jest.Mock).mockResolvedValue(10);

    const module = await Test.createTestingModule({
      providers: [
        BackfillConsolidacaoService,
        { provide: PrismaService, useValue: limitePrisma },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
      ],
    }).compile();
    const svc = module.get(BackfillConsolidacaoService);

    const result = await svc.executar({ loteSize: 5, limite: 2 });

    expect(result.processadas).toBe(2);
    expect(result.ok).toBe(2);
  });

  it('motivo passado ao hook é exatamente "backfill"', async () => {
    await service.executar();

    expect(mockConsolidar.execute).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'backfill' }),
    );
  });

  it('interrompe o loop quando 100% do lote falha (safeguard anti-loop-infinito)', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `v-${i}`);

    // Reset limpa a fila de mockResolvedValueOnce do beforeEach antes de redefinir
    (mockPrisma.client.vistorias.findMany as jest.Mock).mockReset();
    (mockPrisma.client.vistorias.count as jest.Mock).mockReset();

    // findMany retorna sempre as mesmas 10 — ninguém consolida, ninguém sai do filtro
    (mockPrisma.client.vistorias.findMany as jest.Mock).mockResolvedValue(
      ids.map((id) => ({ id })),
    );
    (mockPrisma.client.vistorias.count as jest.Mock).mockResolvedValue(10);
    mockConsolidar.execute.mockRejectedValue(new Error('falha determinística'));

    const resultado = await service.executar({ loteSize: 10 });

    expect(resultado.processadas).toBe(10);
    expect(resultado.ok).toBe(0);
    expect(resultado.erros).toBe(10);
    // Safeguard interrompeu: findMany chamado apenas 1 vez (não entrou em loop)
    expect(mockPrisma.client.vistorias.findMany).toHaveBeenCalledTimes(1);
  });
});
