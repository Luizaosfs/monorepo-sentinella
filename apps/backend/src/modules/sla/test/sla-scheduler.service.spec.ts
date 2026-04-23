import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';
import { EscalarSla } from '../use-cases/escalar-sla';
import { SlaSchedulerService } from '../sla-scheduler.service';

function buildPrismaMock() {
  return {
    client: {
      sla_operacional: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      push_subscriptions: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    },
  } as unknown as PrismaService;
}

describe('SlaSchedulerService', () => {
  let service: SlaSchedulerService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();
  const mockEscalar = { execute: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: EscalarSla, useValue: mockEscalar },
      ],
    }).compile();

    service = module.get(SlaSchedulerService);
  });

  // --- marcarVencidos ---

  it('marcarVencidos: chama updateMany com filtro correto e retorna { vencidos }', async () => {
    (prisma.client.sla_operacional.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

    const result = await service.marcarVencidos();

    expect(result).toEqual({ vencidos: 5 });
    expect(prisma.client.sla_operacional.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['pendente', 'em_atendimento'] },
          deleted_at: null,
        }),
        data: { status: 'vencido', violado: true },
      }),
    );
  });

  it('marcarVencidos: NÃO executa $executeRaw (CASE morto removido)', async () => {
    (prisma.client as any).$executeRaw = jest.fn();

    await service.marcarVencidos();

    expect((prisma.client as any).$executeRaw).not.toHaveBeenCalled();
  });

  // --- escalarIminentes ---

  it('escalarIminentes: sem candidatos retorna { candidatos: 0, escalados: 0, erros: 0 } sem chamar EscalarSla', async () => {
    readRepo.findIminentesGlobal.mockResolvedValue([]);

    const result = await service.escalarIminentes();

    expect(result).toEqual({ candidatos: 0, escalados: 0, erros: 0 });
    expect(mockEscalar.execute).not.toHaveBeenCalled();
  });

  it('escalarIminentes: chama EscalarSla.execute com {tenantId: null, userId: null} para cada candidato', async () => {
    readRepo.findIminentesGlobal.mockResolvedValue([
      { id: 'sla-1', clienteId: 'c1', prioridade: 'P3', prazoFinal: new Date() },
      { id: 'sla-2', clienteId: 'c1', prioridade: 'P4', prazoFinal: new Date() },
    ]);
    mockEscalar.execute.mockResolvedValue({ escalado: true, sla: {} });
    writeRepo.marcarEscalonadoAutomatico.mockResolvedValue(2);

    await service.escalarIminentes();

    expect(mockEscalar.execute).toHaveBeenCalledTimes(2);
    expect(mockEscalar.execute).toHaveBeenCalledWith('sla-1', { tenantId: null, userId: null });
    expect(mockEscalar.execute).toHaveBeenCalledWith('sla-2', { tenantId: null, userId: null });
  });

  it('escalarIminentes: erro em 1 SLA não interrompe os demais (try/catch por linha)', async () => {
    readRepo.findIminentesGlobal.mockResolvedValue([
      { id: 'sla-a', clienteId: 'c1', prioridade: 'P3', prazoFinal: new Date() },
      { id: 'sla-b', clienteId: 'c1', prioridade: 'P4', prazoFinal: new Date() },
    ]);
    mockEscalar.execute
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ escalado: true, sla: {} });
    writeRepo.marcarEscalonadoAutomatico.mockResolvedValue(1);

    const result = await service.escalarIminentes();

    expect(result.erros).toBe(1);
    expect(result.escalados).toBe(1);
    expect(mockEscalar.execute).toHaveBeenCalledTimes(2);
  });

  it('escalarIminentes: chama marcarEscalonadoAutomatico com ids corretos após escaladas bem-sucedidas', async () => {
    readRepo.findIminentesGlobal.mockResolvedValue([
      { id: 'sla-x', clienteId: 'c1', prioridade: 'P3', prazoFinal: new Date() },
    ]);
    mockEscalar.execute.mockResolvedValue({ escalado: true, sla: {} });
    writeRepo.marcarEscalonadoAutomatico.mockResolvedValue(1);

    await service.escalarIminentes();

    expect(writeRepo.marcarEscalonadoAutomatico).toHaveBeenCalledWith(['sla-x']);
  });

  it('escalarIminentes: SLA que retorna {escalado: false} NÃO entra em marcarEscalonadoAutomatico', async () => {
    readRepo.findIminentesGlobal.mockResolvedValue([
      { id: 'sla-p1', clienteId: 'c1', prioridade: 'P1', prazoFinal: new Date() },
    ]);
    mockEscalar.execute.mockResolvedValue({ escalado: false, mensagem: 'Já está na prioridade máxima' });

    await service.escalarIminentes();

    expect(writeRepo.marcarEscalonadoAutomatico).not.toHaveBeenCalled();
  });

  // --- pushCritico ---

  it('pushCritico: filtra prioridade IN (P1, P2) — não mais (alta, critica)', async () => {
    await service.pushCritico();

    expect(prisma.client.sla_operacional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prioridade: { in: ['P1', 'P2'] },
        }),
      }),
    );
  });
});
