import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SaveClienteBody } from '../../dtos/save-cliente.body';
import { ClienteException } from '../../errors/cliente.exception';
import { ClienteReadRepository } from '../../repositories/cliente-read.repository';
import { ClienteWriteRepository } from '../../repositories/cliente-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { SaveCliente } from '../save-cliente';
import { ClienteBuilder } from './builders/cliente.builder';

describe('SaveCliente', () => {
  let useCase: SaveCliente;
  const readRepo = mock<ClienteReadRepository>();
  const writeRepo = mock<ClienteWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveCliente,
        { provide: ClienteReadRepository, useValue: readRepo },
        { provide: ClienteWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<SaveCliente>(SaveCliente);
  });

  it('deve atualizar campos parciais (nome, cnpj, ativo, surtoAtivo, etc.)', async () => {
    const cliente = new ClienteBuilder().withNome('Antigo').withCnpj('111').withAtivo(true).build();
    readRepo.findById.mockResolvedValue(cliente);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(cliente.id!, {
      nome: 'Novo Nome',
      cnpj: '22222222000133',
      ativo: false,
      surtoAtivo: true,
    } as SaveClienteBody);

    expect(cliente.nome).toBe('Novo Nome');
    expect(cliente.cnpj).toBe('22222222000133');
    expect(cliente.ativo).toBe(false);
    expect(cliente.surtoAtivo).toBe(true);
    expect(writeRepo.save).toHaveBeenCalledWith(cliente);
  });

  it('NÃO deve alterar campos não enviados', async () => {
    const cliente = new ClienteBuilder().withNome('Fixo').withCidade('Campinas').build();
    readRepo.findById.mockResolvedValue(cliente);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(cliente.id!, { cnpj: '999' } as SaveClienteBody);

    expect(cliente.nome).toBe('Fixo');
    expect(cliente.cidade).toBe('Campinas');
    expect(cliente.cnpj).toBe('999');
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('x', {} as SaveClienteBody),
      ClienteException.notFound(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
