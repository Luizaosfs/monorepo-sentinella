import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteException } from '../../errors/cliente.exception';
import { ClienteReadRepository } from '../../repositories/cliente-read.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { GetCliente } from '../get-cliente';
import { ClienteBuilder } from './builders/cliente.builder';

describe('GetCliente', () => {
  let useCase: GetCliente;
  const readRepo = mock<ClienteReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetCliente, { provide: ClienteReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<GetCliente>(GetCliente);
  });

  it('deve retornar cliente encontrado', async () => {
    const cliente = new ClienteBuilder().withId('c-1').build();
    readRepo.findById.mockResolvedValue(cliente);

    const result = await useCase.execute('c-1');

    expect(result.cliente).toBe(cliente);
    expect(readRepo.findById).toHaveBeenCalledWith('c-1');
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), ClienteException.notFound());
  });
});
