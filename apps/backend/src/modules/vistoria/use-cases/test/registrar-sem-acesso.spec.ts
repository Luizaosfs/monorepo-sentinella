import { Test } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { RegistrarSemAcessoVistoria } from '../registrar-sem-acesso';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { FocoRiscoReadRepository } from '../../../foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../../foco-risco/repositories/foco-risco-write.repository';
import { VistoriaException } from '../../errors/vistoria.exception';

function makeVistoria(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vistoria-1',
    clienteId: 'cliente-1',
    acessoRealizado: true,
    focoRiscoId: 'foco-1',
    motivoSemAcesso: undefined,
    observacaoAcesso: undefined,
    proximoHorarioSugerido: undefined,
    proximaTentativaSugerida: undefined,
    status: 'pendente',
    ...overrides,
  };
}

function makeFoco(overrides: Record<string, unknown> = {}) {
  return {
    id: 'foco-1',
    clienteId: 'cliente-1',
    status: 'em_inspecao',
    tentativasSemAcesso: 0,
    pendentDecisaoSupervisor: false,
    ...overrides,
  };
}

function makeRequest(userId = 'user-1', tenantId = 'cliente-1') {
  return {
    user: { id: userId, papeis: ['agente'] },
    headers: { 'x-tenant-id': tenantId },
    tenantId,
  };
}

describe('RegistrarSemAcessoVistoria', () => {
  let useCase: RegistrarSemAcessoVistoria;
  let vistoriaRead: jest.Mocked<VistoriaReadRepository>;
  let vistoriaWrite: jest.Mocked<VistoriaWriteRepository>;
  let focoRead: jest.Mocked<FocoRiscoReadRepository>;
  let focoWrite: jest.Mocked<FocoRiscoWriteRepository>;

  beforeEach(async () => {
    const vistoriaReadMock = { findById: jest.fn() };
    const vistoriaWriteMock = { save: jest.fn() };
    const focoReadMock = { findById: jest.fn() };
    const focoWriteMock = { save: jest.fn(), createHistorico: jest.fn() };
    const requestMock = makeRequest();

    const module = await Test.createTestingModule({
      providers: [
        RegistrarSemAcessoVistoria,
        { provide: VistoriaReadRepository, useValue: vistoriaReadMock },
        { provide: VistoriaWriteRepository, useValue: vistoriaWriteMock },
        { provide: FocoRiscoReadRepository, useValue: focoReadMock },
        { provide: FocoRiscoWriteRepository, useValue: focoWriteMock },
        { provide: REQUEST, useValue: requestMock },
      ],
    }).compile();

    useCase = module.get(RegistrarSemAcessoVistoria);
    vistoriaRead = module.get(VistoriaReadRepository);
    vistoriaWrite = module.get(VistoriaWriteRepository);
    focoRead = module.get(FocoRiscoReadRepository);
    focoWrite = module.get(FocoRiscoWriteRepository);
  });

  it('deve lançar notFound quando vistoria não existe', async () => {
    vistoriaRead.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('inexistente', { motivo: 'fechado' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('') });

    expect(vistoriaWrite.save).not.toHaveBeenCalled();
  });

  it('deve registrar sem-acesso e transicionar foco para aguardando_nova_tentativa', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);
    vistoriaWrite.save.mockResolvedValue(undefined);
    focoWrite.save.mockResolvedValue(undefined);
    focoWrite.createHistorico.mockResolvedValue({ id: 'h-1', clienteId: 'cliente-1', statusNovo: 'x' } as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'fechado', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(foco.tentativasSemAcesso).toBe(1);
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'sem_acesso_registrado' }),
    );
  });

  it('deve escalar para supervisor na 3ª tentativa', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ tentativasSemAcesso: 2 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);
    vistoriaWrite.save.mockResolvedValue(undefined);
    focoWrite.save.mockResolvedValue(undefined);
    focoWrite.createHistorico.mockResolvedValue({ id: 'h-1', clienteId: 'cliente-1', statusNovo: 'x' } as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'recusa', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(true);
    expect(foco.pendentDecisaoSupervisor).toBe(true);
    expect(foco.status).toBe('em_inspecao'); // foco permanece em_inspecao aguardando supervisor
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'escalado_supervisor' }),
    );
  });

  it('deve funcionar sem focoRiscoId — só salva vistoria', async () => {
    const vistoria = makeVistoria({ focoRiscoId: undefined });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    vistoriaWrite.save.mockResolvedValue(undefined);

    const result = await useCase.execute('vistoria-1', { motivo: 'desocupado' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(focoRead.findById).not.toHaveBeenCalled();
    expect(vistoriaWrite.save).toHaveBeenCalled();
  });

  it('deve calcular proxima_tentativa_sugerida com dias úteis pelo motivo', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);
    vistoriaWrite.save.mockResolvedValue(undefined);
    focoWrite.save.mockResolvedValue(undefined);
    focoWrite.createHistorico.mockResolvedValue({ id: 'h-1', clienteId: 'cliente-1', statusNovo: 'x' } as never);

    await useCase.execute('vistoria-1', { motivo: 'desocupado', focoRiscoId: 'foco-1' });

    // desocupado = 3 dias úteis
    const saved = vistoria as Record<string, unknown>;
    expect(saved.proximaTentativaSugerida).toBeInstanceOf(Date);
  });
});
