import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';

import { CreateVistoriaBody } from '../../dtos/create-vistoria.body';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { ConsolidarVistoria } from '../consolidar-vistoria';
import { CreateVistoria } from '../create-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

describe('CreateVistoria', () => {
  let useCase: CreateVistoria;
  const readRepo = mock<VistoriaReadRepository>();
  const writeRepo = mock<VistoriaWriteRepository>();
  const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: VistoriaWriteRepository, useValue: writeRepo },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
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

    useCase = module.get<CreateVistoria>(CreateVistoria);
  });

  const baseInput = (): CreateVistoriaBody =>
    ({
      ciclo: 1,
      tipoAtividade: 'LI',
      dataVisita: new Date('2024-06-01T10:00:00Z'),
    }) as CreateVistoriaBody;

  it('deve criar vistoria e retornar detalhes completos', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a1')
      .build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(full);
    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: '00000000-0000-4000-8000-000000000001',
        agenteId: '00000000-0000-4000-8000-000000000003',
        status: 'pendente',
      }),
    );
    expect(readRepo.findByIdComDetalhes).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-0000000000a1',
    );
  });

  it('deve persistir depósitos quando informados', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a1')
      .build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({
      ...baseInput(),
      depositos: [{ tipoDeposito: 'A1', quantidade: 2 }],
    } as CreateVistoriaBody);

    expect(writeRepo.createDeposito).toHaveBeenCalledWith(
      expect.objectContaining({
        vistoriaId: '00000000-0000-4000-8000-0000000000a1',
        tipoDeposito: 'A1',
      }),
    );
  });

  it('deve usar clienteId do tenant (MT-02) mesmo quando clienteId é enviado no body', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a2')
      .withClienteId('00000000-0000-4000-8000-000000000001')
      .build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({
      ...baseInput(),
      clienteId: '00000000-0000-4000-8000-000000009999',
    } as CreateVistoriaBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: '00000000-0000-4000-8000-000000000001',
      }),
    );
  });

  it('invoca hook ConsolidarVistoria após criar vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000a3';
    const created = new VistoriaBuilder().withId(id).build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute(baseInput());

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: id,
      motivo: 'automático — INSERT em vistorias',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000a4';
    const created = new VistoriaBuilder().withId(id).build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('stub boom'));

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(full);
  });
});
