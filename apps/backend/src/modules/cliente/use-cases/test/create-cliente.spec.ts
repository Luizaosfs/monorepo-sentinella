import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CreateClienteBody } from '../../dtos/create-cliente.body';
import { ClienteException } from '../../errors/cliente.exception';
import { ClienteReadRepository } from '../../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../../repositories/cliente-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateCliente } from '../create-cliente';
import { ClienteBuilder } from './builders/cliente.builder';

describe('CreateCliente', () => {
  let useCase: CreateCliente;
  const readRepo = mock<ClienteReadRepository>();
  const writeRepo = mock<ClienteWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCliente,
        { provide: ClienteReadRepository, useValue: readRepo },
        { provide: ClienteWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<CreateCliente>(CreateCliente);
  });

  it('deve criar cliente com ativo=true e surtoAtivo=false', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    const created = new ClienteBuilder().build();
    writeRepo.create.mockResolvedValue(created);

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
    );
    expect(result.cliente).toBe(created);
  });

  it('deve usar janelaRecorrenciaDias=30 como padrão', async () => {
    readRepo.findBySlug.mockResolvedValue(null);
    writeRepo.create.mockImplementation(async (c) => c);

    await useCase.execute({
      nome: 'Novo Município',
      slug: 'novo-municipio-2',
    } as CreateClienteBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ janelaRecorrenciaDias: 30 }),
    );
  });

  it('deve rejeitar slug duplicado', async () => {
    readRepo.findBySlug.mockResolvedValue(new ClienteBuilder().withSlug('dup').build());

    await expectHttpException(
      () =>
        useCase.execute({
          nome: 'X',
          slug: 'dup',
        } as CreateClienteBody),
      ClienteException.slugAlreadyExists(),
    );
    expect(writeRepo.create).not.toHaveBeenCalled();
  });
});
