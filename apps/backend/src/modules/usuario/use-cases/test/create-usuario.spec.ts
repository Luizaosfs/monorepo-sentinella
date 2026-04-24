jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { CreateUsuarioBody } from '../../dtos/create-usuario.body';
import { UsuarioException } from '../../errors/usuario.exception';
import { UsuarioReadRepository } from '../../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../../repositories/usuario-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateUsuario } from '../create-usuario';
import { UsuarioBuilder } from './builders/usuario.builder';

describe('CreateUsuario', () => {
  let useCase: CreateUsuario;
  const readRepo = mock<UsuarioReadRepository>();
  const writeRepo = mock<UsuarioWriteRepository>();
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUsuario,
        { provide: UsuarioReadRepository, useValue: readRepo },
        { provide: UsuarioWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
      ],
    }).compile();
    useCase = module.get<CreateUsuario>(CreateUsuario);
  });

  it('deve criar usuário com email normalizado (lowercase + trim)', async () => {
    readRepo.findByEmail.mockResolvedValue(null);
    const created = new UsuarioBuilder().withEmail('test@test.com').build();
    writeRepo.create.mockResolvedValue(created);

    await useCase.execute({
      nome: 'Fulano',
      email: '  Test@TEST.com ',
      senha: 'senha123456',
      papeis: ['agente'],
    } as CreateUsuarioBody);

    expect(readRepo.findByEmail).toHaveBeenCalledWith('test@test.com');
    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@test.com',
      }),
    );
  });

  it('deve gerar hash da senha', async () => {
    readRepo.findByEmail.mockResolvedValue(null);
    writeRepo.create.mockImplementation(async (u) => u);

    await useCase.execute({
      nome: 'Fulano',
      email: 'a@b.com',
      senha: 'minhasenha',
      papeis: ['supervisor'],
    } as CreateUsuarioBody);

    expect(bcrypt.hash).toHaveBeenCalledWith('minhasenha', 10);
  });

  it('quota ok → cria usuário normalmente', async () => {
    readRepo.findByEmail.mockResolvedValue(null);
    const created = new UsuarioBuilder().build();
    writeRepo.create.mockResolvedValue(created);

    const result = await useCase.execute({
      nome: 'Fulano',
      email: 'ok@test.com',
      senha: 'senha123456',
      papeis: ['agente'],
      clienteId: 'cliente-uuid-1',
    } as CreateUsuarioBody);

    expect(result.usuario).toBe(created);
    expect(mockVerificarQuota.execute).toHaveBeenCalledWith('cliente-uuid-1', { metrica: 'usuarios_ativos' });
  });

  it('quota excedida → throw ForbiddenException antes de criar usuário', async () => {
    readRepo.findByEmail.mockResolvedValue(null);
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 10, limite: 10, motivo: 'excedido' });

    await expect(
      useCase.execute({
        nome: 'X',
        email: 'x@test.com',
        senha: 'senha123456',
        papeis: ['agente'],
        clienteId: 'cliente-uuid-1',
      } as CreateUsuarioBody),
    ).rejects.toThrow(ForbiddenException);

    expect(writeRepo.create).not.toHaveBeenCalled();
  });

  it('deve rejeitar email duplicado', async () => {
    readRepo.findByEmail.mockResolvedValue(new UsuarioBuilder().build());

    await expectHttpException(
      () =>
        useCase.execute({
          nome: 'X',
          email: 'dup@test.com',
          senha: 'senha123456',
          papeis: ['agente'],
        } as CreateUsuarioBody),
      UsuarioException.emailAlreadyExists(),
    );
    expect(writeRepo.create).not.toHaveBeenCalled();
  });
});
