import { Test } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { RegistrarSemAcessoVistoria } from '../registrar-sem-acesso';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { FocoRiscoReadRepository } from '../../../foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../../foco-risco/repositories/foco-risco-write.repository';

const HISTORICO_STUB = { id: 'h-1', clienteId: 'cliente-1', statusNovo: 'x' } as never;

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
    scorePrioridade: 20,
    ...overrides,
  };
}

describe('RegistrarSemAcessoVistoria', () => {
  let useCase: RegistrarSemAcessoVistoria;
  let vistoriaRead: jest.Mocked<VistoriaReadRepository>;
  let focoRead: jest.Mocked<FocoRiscoReadRepository>;
  let focoWrite: jest.Mocked<FocoRiscoWriteRepository>;

  beforeEach(async () => {
    const vistoriaReadMock = { findById: jest.fn() };
    const vistoriaWriteMock = { save: jest.fn() };
    const focoReadMock = { findById: jest.fn() };
    const focoWriteMock = {
      save: jest.fn(),
      createHistorico: jest.fn().mockResolvedValue(HISTORICO_STUB),
      updateScorePrioridade: jest.fn(),
    };
    const requestMock = {
      user: { id: 'user-1', papeis: ['agente'] },
      headers: { 'x-tenant-id': 'cliente-1' },
      tenantId: 'cliente-1',
    };

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
    focoRead = module.get(FocoRiscoReadRepository);
    focoWrite = module.get(FocoRiscoWriteRepository);
  });

  it('fechado: transiciona para aguardando_nova_tentativa e calcula 1 dia útil', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'fechado', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(foco.tentativasSemAcesso).toBe(1);
    expect(result.proximaTentativa).toBeInstanceOf(Date);
    // fechado = 1 dia útil → não deve ser sábado/domingo
    const dia = (result.proximaTentativa as Date).getDay();
    expect(dia).not.toBe(0);
    expect(dia).not.toBe(6);
    // 1ª tentativa: delta fechado = 0 (só aplica a partir da 2ª)
    expect(focoWrite.updateScorePrioridade).not.toHaveBeenCalled();
  });

  it('recusa: +2 dias úteis, score +10, histórico com motivo enriquecido', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ scorePrioridade: 30 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'recusa', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(focoWrite.updateScorePrioridade).toHaveBeenCalledWith('foco-1', 40); // 30+10
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoEvento: 'sem_acesso_registrado',
        motivo: expect.stringContaining('1/3'),
      }),
    );
  });

  it('desocupado: +3 dias úteis, score +0', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ scorePrioridade: 50 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'desocupado', focoRiscoId: 'foco-1' });

    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(focoWrite.updateScorePrioridade).not.toHaveBeenCalled();
  });

  it('sem_previsao: vai para aguardando_nova_tentativa + pendente_decisao_supervisor=true + sem data', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'sem_previsao', focoRiscoId: 'foco-1' });

    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(foco.pendentDecisaoSupervisor).toBe(true);
    expect(result.escaladoSupervisor).toBe(true);
    expect(result.proximaTentativa).toBeNull();
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'escalado_supervisor' }),
    );
  });

  it('3ª tentativa: escala supervisor e acrescenta +10 extra ao score', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ tentativasSemAcesso: 2, scorePrioridade: 60 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'recusa', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(true);
    expect(foco.pendentDecisaoSupervisor).toBe(true);
    expect(foco.tentativasSemAcesso).toBe(3);
    // recusa(10) + extra 3ª tentativa(10) = 20; cap(60+20=80 ≤ 100)
    expect(focoWrite.updateScorePrioridade).toHaveBeenCalledWith('foco-1', 80);
  });

  it('score respeita cap 100', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ tentativasSemAcesso: 2, scorePrioridade: 95 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'recusa', focoRiscoId: 'foco-1' });

    expect(focoWrite.updateScorePrioridade).toHaveBeenCalledWith('foco-1', 100);
  });

  it('sem focoRiscoId: só salva vistoria, não acessa repositório de foco', async () => {
    const vistoria = makeVistoria({ focoRiscoId: undefined });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'desocupado' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(focoRead.findById).not.toHaveBeenCalled();
  });

  it('não cria novo foco — focoId original é preservado', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'fechado', focoRiscoId: 'foco-1' });

    // nenhum create foi chamado — apenas save
    expect(focoWrite.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'foco-1' }));
  });
});
