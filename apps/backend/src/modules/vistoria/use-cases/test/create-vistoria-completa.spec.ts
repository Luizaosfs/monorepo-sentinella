import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CriarFocoDeVistoriaDeposito } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-vistoria-deposito';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateVistoriaCompletaBody } from '../../dtos/create-vistoria-completa.body';
import { Vistoria } from '../../entities/vistoria';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { CreateVistoriaCompleta } from '../create-vistoria-completa';

describe('CreateVistoriaCompleta', () => {
  let useCase: CreateVistoriaCompleta;
  const writeRepo = mock<VistoriaWriteRepository>();
  const criarFoco = { execute: jest.fn().mockResolvedValue({ criado: false }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVistoriaCompleta,
        { provide: VistoriaWriteRepository, useValue: writeRepo },
        { provide: CriarFocoDeVistoriaDeposito, useValue: criarFoco },
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

  it('não dispara hook quando nenhum depósito tem foco', async () => {
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

  it('falha no hook não deve quebrar a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000b5';
    writeRepo.createCompleta.mockResolvedValue(id);
    criarFoco.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await useCase.execute({
      ...baseInput(),
      depositos: [{ tipoDeposito: 'B', comLarva: true }],
    } as CreateVistoriaCompletaBody);

    expect(result).toEqual({ id });
  });
});
