import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { UsuarioReadRepository } from '../../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../../repositories/usuario-write.repository';
import { AtribuirPapel } from '../atribuir-papel';

const USER_ID = '00000000-0000-4000-8000-000000000010';
const AUTH_ID = 'auth-uuid-0000-0000-0000-000000000001';
const CLIENTE_ID = '00000000-0000-4000-8000-000000000001';

const readRepo = mock<UsuarioReadRepository>();
const writeRepo = mock<UsuarioWriteRepository>();

function makeReq(isPlatformAdmin = true) {
  return {
    user: { papeis: isPlatformAdmin ? ['admin'] : ['supervisor'], isPlatformAdmin },
  };
}

function makeUseCase(isPlatformAdmin = true) {
  return new AtribuirPapel(readRepo, writeRepo, makeReq(isPlatformAdmin) as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  writeRepo.atribuirPapel.mockResolvedValue(undefined);
  readRepo.usuarioTemPapel.mockResolvedValue(false);
});

describe('AtribuirPapel', () => {
  it('não-admin tenta atribuir → throw ForbiddenException', async () => {
    const useCase = makeUseCase(false);
    await expect(useCase.execute(USER_ID, 'supervisor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.atribuirPapel).not.toHaveBeenCalled();
  });

  it('usuário alvo não existe → throw UsuarioException.notFound', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue(null);
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'supervisor')).rejects.toMatchObject({
      response: { statusCode: 404, message: 'Usuário não encontrado' },
    });
  });

  it('atribuir admin a usuário com clienteId → throw BadRequestException', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: CLIENTE_ID });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'admin')).rejects.toBeInstanceOf(BadRequestException);
    await expect(useCase.execute(USER_ID, 'admin')).rejects.toMatchObject({
      message: expect.stringContaining('papel admin não pode ter cliente_id preenchido'),
    });
  });

  it('atribuir admin a usuário sem clienteId → ok', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: null });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'admin')).resolves.toBeUndefined();
    expect(writeRepo.atribuirPapel).toHaveBeenCalled();
  });

  it('atribuir supervisor a usuário sem clienteId → throw BadRequestException', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: null });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'supervisor')).rejects.toBeInstanceOf(BadRequestException);
    await expect(useCase.execute(USER_ID, 'supervisor')).rejects.toMatchObject({
      message: expect.stringContaining('papel supervisor requer cliente_id'),
    });
  });

  it('atribuir supervisor a usuário com clienteId → ok', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: CLIENTE_ID });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'supervisor')).resolves.toBeUndefined();
    expect(writeRepo.atribuirPapel).toHaveBeenCalled();
  });

  it('atribuir agente sem clienteId → throw BadRequestException', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: null });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'agente')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atribuir notificador sem clienteId → throw BadRequestException', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: null });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'notificador')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atribuir analista_regional sem clienteId → ok (fora da regra G.5)', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: null });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'analista_regional')).resolves.toBeUndefined();
    expect(writeRepo.atribuirPapel).toHaveBeenCalled();
  });

  it('atribuir analista_regional com clienteId → ok (fora da regra G.5)', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: CLIENTE_ID });
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'analista_regional')).resolves.toBeUndefined();
    expect(writeRepo.atribuirPapel).toHaveBeenCalled();
  });

  it('idempotência: usuário já tem o papel → return sem chamar writeRepo', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: CLIENTE_ID });
    readRepo.usuarioTemPapel.mockResolvedValue(true);
    const useCase = makeUseCase();
    await expect(useCase.execute(USER_ID, 'supervisor')).resolves.toBeUndefined();
    expect(writeRepo.atribuirPapel).not.toHaveBeenCalled();
  });

  it('write recebe authId (não userId) como primeiro argumento', async () => {
    readRepo.findAuthIdAndClienteIdById.mockResolvedValue({ authId: AUTH_ID, clienteId: CLIENTE_ID });
    const useCase = makeUseCase();
    await useCase.execute(USER_ID, 'supervisor');
    expect(writeRepo.atribuirPapel).toHaveBeenCalledWith(AUTH_ID, 'supervisor');
    expect(writeRepo.atribuirPapel).not.toHaveBeenCalledWith(USER_ID, expect.anything());
  });
});
