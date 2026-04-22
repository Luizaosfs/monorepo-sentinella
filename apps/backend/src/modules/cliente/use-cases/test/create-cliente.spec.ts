import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { mock } from 'jest-mock-extended';

import { CreateClienteBody } from '../../dtos/create-cliente.body';
import { ClienteException } from '../../errors/cliente.exception';
import { ClienteReadRepository } from '../../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../../repositories/cliente-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateCliente } from '../create-cliente';
import { SeedClienteNovo } from '../seed-cliente-novo';
import { ClienteBuilder } from './builders/cliente.builder';

const FAKE_TX = { __isFakeTx: true };

describe('CreateCliente', () => {
  let useCase: CreateCliente;
  const readRepo = mock<ClienteReadRepository>();
  const writeRepo = mock<ClienteWriteRepository>();
  const seedClienteNovo = mock<SeedClienteNovo>();
  const prismaService = {
    client: {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(FAKE_TX)),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.client.$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(FAKE_TX),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCliente,
        { provide: PrismaService, useValue: prismaService },
        { provide: ClienteReadRepository, useValue: readRepo },
        { provide: ClienteWriteRepository, useValue: writeRepo },
        { provide: SeedClienteNovo, useValue: seedClienteNovo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<CreateCliente>(CreateCliente);
  });

  it('deve criar cliente com ativo=true e surtoAtivo=false', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    const created = new ClienteBuilder().build();
    writeRepo.create.mockResolvedValue(created);
    seedClienteNovo.execute.mockResolvedValue({} as never);

    const input: CreateClienteBody = {
      nome: 'Novo Município',
      slug: 'novo-municipio',
    } as CreateClienteBody;

    const result = await useCase.execute(input);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ativo: true,
        surtoAtivo: false,
      }),
      FAKE_TX,
    );
    expect(result.cliente).toBe(created);
  });

  it('deve usar janelaRecorrenciaDias=30 como padrão', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    writeRepo.create.mockResolvedValue(new ClienteBuilder().withId('id-default-window').build());
    seedClienteNovo.execute.mockResolvedValue({} as never);

    await useCase.execute({
      nome: 'Novo Município',
      slug: 'novo-municipio-2',
    } as CreateClienteBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ janelaRecorrenciaDias: 30 }),
      FAKE_TX,
    );
  });

  it('deve rejeitar slug duplicado sem abrir transação', async () => {
    readRepo.findBySlug.mockResolvedValue(new ClienteBuilder().withSlug('dup').build());

    await expectHttpException(
      () =>
        useCase.execute({
          nome: 'X',
          slug: 'dup',
        } as CreateClienteBody),
      ClienteException.slugAlreadyExists(),
    );
    expect(prismaService.client.$transaction).not.toHaveBeenCalled();
    expect(writeRepo.create).not.toHaveBeenCalled();
    expect(seedClienteNovo.execute).not.toHaveBeenCalled();
  });

  it('dispara SeedClienteNovo com clienteId criado e mesma tx do create', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    const created = new ClienteBuilder().withId('cliente-novo-id').build();
    writeRepo.create.mockResolvedValue(created);
    seedClienteNovo.execute.mockResolvedValue({} as never);

    await useCase.execute({
      nome: 'X',
      slug: 'novo',
    } as CreateClienteBody);

    expect(prismaService.client.$transaction).toHaveBeenCalledTimes(1);
    expect(seedClienteNovo.execute).toHaveBeenCalledWith('cliente-novo-id', FAKE_TX);
  });

  it('falha em SeedClienteNovo propaga (rollback do INSERT cliente)', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    writeRepo.create.mockResolvedValue(new ClienteBuilder().build());
    seedClienteNovo.execute.mockRejectedValue(new Error('seed sla_foco_config falhou'));

    await expect(
      useCase.execute({ nome: 'X', slug: 'falho' } as CreateClienteBody),
    ).rejects.toThrow('seed sla_foco_config falhou');
  });

  it('falha em writeRepo.create não invoca seed', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    writeRepo.create.mockRejectedValue(new Error('insert clientes falhou'));

    await expect(
      useCase.execute({ nome: 'X', slug: 'falho2' } as CreateClienteBody),
    ).rejects.toThrow('insert clientes falhou');
    expect(seedClienteNovo.execute).not.toHaveBeenCalled();
  });
});
