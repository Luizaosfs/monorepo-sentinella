import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { VistoriaException } from '../../errors/vistoria.exception';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { AtualizarPerfilImovel } from '../atualizar-perfil-imovel';
import { ConsolidarVistoria } from '../consolidar-vistoria';
import { SaveVistoria } from '../save-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

const mockReq: any = {};

describe('SaveVistoria', () => {
  let useCase: SaveVistoria;
  const readRepo = mock<VistoriaReadRepository>();
  const writeRepo = mock<VistoriaWriteRepository>();
  const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockAtualizarPerfil = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAtualizarPerfil.execute.mockResolvedValue(undefined);
    mockReq.user = { isPlatformAdmin: true };
    mockReq.tenantId = undefined;
    useCase = new SaveVistoria(readRepo, writeRepo, mockConsolidar as any, mockAtualizarPerfil as any, mockReq as any);
  });

  it('deve lançar notFound quando vistoria não existe', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute('00000000-0000-4000-8000-0000000000ff', {
          status: 'ok',
        }),
      VistoriaException.notFound(),
    );
  });

  it('deve aplicar patch e salvar', async () => {
    const v = new VistoriaBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    const { vistoria } = await useCase.execute(v.id!, {
      status: 'concluida',
      observacao: 'ok',
    });

    expect(vistoria.status).toBe('concluida');
    expect(vistoria.observacao).toBe('ok');
    expect(writeRepo.save).toHaveBeenCalledWith(vistoria);
  });

  it('invoca hook ConsolidarVistoria após salvar vistoria', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d1').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida' });

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: v.id,
      motivo: 'automático — UPDATE em vistorias',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar o save', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d2').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('boom'));

    const result = await useCase.execute(v.id!, { status: 'concluida' });

    expect(result.vistoria).toBe(v);
  });

  it('muda coluna-input (status) → hook é chamado', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d3').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida' });

    expect(mockConsolidar.execute).toHaveBeenCalledTimes(1);
  });

  it('muda apenas campo não-input (observacao) → hook NÃO é chamado', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d4').withStatus('concluida').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { observacao: 'nova observacao' });

    expect(mockConsolidar.execute).not.toHaveBeenCalled();
  });

  it('múltiplas colunas-input mudam → hook é chamado apenas 1 vez', async () => {
    const v = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000d5').withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { status: 'concluida', gravidas: true, idosos: true });

    expect(mockConsolidar.execute).toHaveBeenCalledTimes(1);
  });

  // K.4 — fn_atualizar_perfil_imovel
  it('K.4 — transição acessoRealizado true→false → AtualizarPerfilImovel invocado', async () => {
    const v = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000d6')
      .withImovelId('imovel-k4-sv-1')
      .withAcessoRealizado(true)
      .build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { acessoRealizado: false });

    expect(mockAtualizarPerfil.execute).toHaveBeenCalledWith({
      imovelId: 'imovel-k4-sv-1',
      vistoriaId: v.id,
      agenteId: expect.anything(),
      clienteId: v.clienteId,
    });
  });

  it('K.4 — transição false→true → AtualizarPerfilImovel É invocado (pode resetar branch 3)', async () => {
    const v = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000d7')
      .withImovelId('imovel-k4-sv-2')
      .withAcessoRealizado(false)
      .build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { acessoRealizado: true });

    expect(mockAtualizarPerfil.execute).toHaveBeenCalledWith({
      imovelId: 'imovel-k4-sv-2',
      vistoriaId: v.id,
      agenteId: expect.anything(),
      clienteId: v.clienteId,
    });
  });

  it('K.4 — sem transição (acessoRealizado permanece igual) → AtualizarPerfilImovel NÃO invocado', async () => {
    const v = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000d8')
      .withImovelId('imovel-k4-sv-3')
      .withAcessoRealizado(true)
      .build();
    readRepo.findById.mockResolvedValue(v);

    await useCase.execute(v.id!, { acessoRealizado: true });

    expect(mockAtualizarPerfil.execute).not.toHaveBeenCalled();
  });

  it('K.4 — falha em AtualizarPerfilImovel NÃO quebra o save', async () => {
    const v = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000d9')
      .withImovelId('imovel-k4-sv-4')
      .withAcessoRealizado(true)
      .build();
    readRepo.findById.mockResolvedValue(v);
    mockAtualizarPerfil.execute.mockRejectedValueOnce(new Error('db timeout'));

    const result = await useCase.execute(v.id!, { acessoRealizado: false });

    expect(result.vistoria).toBe(v);
  });

  it('tenant errado → throw ForbiddenException, save não executado', async () => {
    const v = new VistoriaBuilder().build();
    readRepo.findById.mockResolvedValue(v);
    const wrongTenantReq = { user: { isPlatformAdmin: false }, tenantId: 'cli-ERRADO' };
    const uc = new SaveVistoria(readRepo, writeRepo, mockConsolidar as any, mockAtualizarPerfil as any, wrongTenantReq as any);

    await expect(uc.execute(v.id!, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
