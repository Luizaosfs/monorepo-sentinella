import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { CriarFocoDeVistoriaDeposito } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-vistoria-deposito';
import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateVistoriaCompletaBody } from '../../dtos/create-vistoria-completa.body';
import { Vistoria } from '../../entities/vistoria';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { ConsolidarVistoria } from '../consolidar-vistoria';
import { CreateVistoriaCompleta } from '../create-vistoria-completa';
import { ValidarCicloVistoria } from '../validar-ciclo-vistoria';

describe('CreateVistoriaCompleta', () => {
  let useCase: CreateVistoriaCompleta;
  const writeRepo = mock<VistoriaWriteRepository>();
  const criarFoco = { execute: jest.fn().mockResolvedValue({ criado: false }) };
  const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockEnfileirar = { enfileirarPorImovel: jest.fn().mockResolvedValue(undefined) };
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };
  const mockValidarCiclo = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    mockValidarCiclo.execute.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVistoriaCompleta,
        { provide: VistoriaWriteRepository, useValue: writeRepo },
        { provide: CriarFocoDeVistoriaDeposito, useValue: criarFoco },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
        { provide: EnfileirarScoreImovel, useValue: mockEnfileirar },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
        { provide: ValidarCicloVistoria, useValue: mockValidarCiclo },
        {
          provide: REQUEST,
          useValue: mockRequest({
            tenantId: '00000000-0000-4000-8000-000000000001',
            user: {
              id: '00000000-0000-4000-8000-000000000003',
              email: 'a@b.com',
              nome: 'Agente',
              clienteId: '00000000-0000-4000-8000-000000000001',
              papeis: ['agente'],
            },
          }),
        },
      ],
    }).compile();

    useCase = module.get<CreateVistoriaCompleta>(CreateVistoriaCompleta);
  });

  const baseInput = (): CreateVistoriaCompletaBody =>
    ({
      ciclo: 1,
      tipoAtividade: 'LI',
      dataVisita: new Date('2024-06-01T10:00:00Z'),
    }) as CreateVistoriaCompletaBody;

  it('deve delegar createCompleta e retornar id', async () => {
    const id = '00000000-0000-4000-8000-0000000000b1';
    writeRepo.createCompleta.mockResolvedValue(id);

    const result = await useCase.execute(baseInput());

    expect(result).toEqual({ id });
    const [entity, sub, idem] = writeRepo.createCompleta.mock.calls[0];
    expect(entity).toBeInstanceOf(Vistoria);
    expect(entity.clienteId).toBe('00000000-0000-4000-8000-000000000001');
    expect(entity.agenteId).toBe('00000000-0000-4000-8000-000000000003');
    expect(sub).toEqual({
      depositos: undefined,
      sintomas: undefined,
      riscos: undefined,
      calhas: undefined,
    });
    expect(idem).toBeUndefined();
  });

  it('deve repassar subitens e idempotencyKey', async () => {
    const id = '00000000-0000-4000-8000-0000000000b2';
    writeRepo.createCompleta.mockResolvedValue(id);
    const key = '00000000-0000-4000-8000-0000000000c1';

    await useCase.execute({
      ...baseInput(),
      idempotencyKey: key,
      depositos: [{ tipoDeposito: 'B' }],
    } as CreateVistoriaCompletaBody);

    expect(writeRepo.createCompleta).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        depositos: [{ tipoDeposito: 'B' }],
      }),
      key,
    );
  });

  it('dispara hook CriarFocoDeVistoriaDeposito no primeiro depósito com foco', async () => {
    const id = '00000000-0000-4000-8000-0000000000b3';
    writeRepo.createCompleta.mockResolvedValue(id);

    await useCase.execute({
      ...baseInput(),
      depositos: [
        { tipoDeposito: 'A', comLarva: false },
        { tipoDeposito: 'B', comLarva: true },
        { tipoDeposito: 'C', comLarva: true },
      ],
    } as CreateVistoriaCompletaBody);

    expect(criarFoco.execute).toHaveBeenCalledTimes(1);
    expect(criarFoco.execute).toHaveBeenCalledWith({
      vistoriaId: id,
      qtdComFocos: 1,
    });
  });

  it('não dispara hook CriarFoco quando nenhum depósito tem foco', async () => {
    const id = '00000000-0000-4000-8000-0000000000b4';
    writeRepo.createCompleta.mockResolvedValue(id);

    await useCase.execute({
      ...baseInput(),
      depositos: [
        { tipoDeposito: 'A', comLarva: false },
        { tipoDeposito: 'B', comLarva: false },
      ],
    } as CreateVistoriaCompletaBody);

    expect(criarFoco.execute).not.toHaveBeenCalled();
  });

  it('falha no hook CriarFoco não deve quebrar a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000b5';
    writeRepo.createCompleta.mockResolvedValue(id);
    criarFoco.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await useCase.execute({
      ...baseInput(),
      depositos: [{ tipoDeposito: 'B', comLarva: true }],
    } as CreateVistoriaCompletaBody);

    expect(result).toEqual({ id });
  });

  it('hook ConsolidarVistoria é chamado EXATAMENTE 1 vez mesmo com múltiplos depósitos (anti-recursão)', async () => {
    const id = '00000000-0000-4000-8000-0000000000b6';
    writeRepo.createCompleta.mockResolvedValue(id);

    await useCase.execute({
      ...baseInput(),
      depositos: [
        { tipoDeposito: 'A', comLarva: true },
        { tipoDeposito: 'B', comLarva: true },
        { tipoDeposito: 'C', comLarva: true },
      ],
    } as CreateVistoriaCompletaBody);

    expect(mockConsolidar.execute).toHaveBeenCalledTimes(1);
    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: id,
      motivo: 'automático — INSERT em vistorias',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000b7';
    writeRepo.createCompleta.mockResolvedValue(id);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('consolidar boom'));

    const result = await useCase.execute(baseInput());

    expect(result).toEqual({ id });
  });

  it('enfileira score do imóvel quando imovelId presente e acessoRealizado=true', async () => {
    const id = '00000000-0000-4000-8000-0000000000b8';
    writeRepo.createCompleta.mockResolvedValue(id);

    await useCase.execute({ ...baseInput(), imovelId: 'imovel-uuid-1', acessoRealizado: true } as any);

    expect(mockEnfileirar.enfileirarPorImovel).toHaveBeenCalledWith(
      'imovel-uuid-1',
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('quota ok → cria vistoria completa normalmente', async () => {
    const id = '00000000-0000-4000-8000-0000000000ba';
    writeRepo.createCompleta.mockResolvedValue(id);

    const result = await useCase.execute(baseInput());

    expect(result).toEqual({ id });
    expect(mockVerificarQuota.execute).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      { metrica: 'vistorias_mes' },
    );
  });

  it('quota excedida → throw ForbiddenException antes de criar vistoria completa', async () => {
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 50, limite: 50, motivo: 'excedido' });

    await expect(useCase.execute(baseInput())).rejects.toThrow(ForbiddenException);

    expect(writeRepo.createCompleta).not.toHaveBeenCalled();
  });

  it('ciclo inválido → BadRequestException antes de criar vistoria completa', async () => {
    mockValidarCiclo.execute.mockRejectedValueOnce(new ForbiddenException('ciclo inválido'));

    await expect(useCase.execute(baseInput())).rejects.toThrow(ForbiddenException);

    expect(writeRepo.createCompleta).not.toHaveBeenCalled();
  });

  it('ValidarCicloVistoria é chamado com clienteId do tenant e ciclo do input', async () => {
    const id = '00000000-0000-4000-8000-0000000000bc';
    writeRepo.createCompleta.mockResolvedValue(id);

    await useCase.execute({ ...baseInput(), ciclo: 2 } as CreateVistoriaCompletaBody);

    expect(mockValidarCiclo.execute).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      2,
    );
  });

  it('falha no hook enfileirarScore NÃO interrompe a criação da vistoria completa', async () => {
    const id = '00000000-0000-4000-8000-0000000000b9';
    writeRepo.createCompleta.mockResolvedValue(id);
    mockEnfileirar.enfileirarPorImovel.mockRejectedValueOnce(new Error('job_queue down'));

    const result = await useCase.execute({ ...baseInput(), imovelId: 'imovel-uuid-1', acessoRealizado: true } as any);

    expect(result).toEqual({ id });
  });
});
