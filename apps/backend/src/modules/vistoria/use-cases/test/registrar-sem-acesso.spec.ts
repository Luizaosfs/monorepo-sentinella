import { Test } from '@nestjs/testing';
import { REQUEST } from '@nestjs/core';
import { mockRequest } from '@test/utils/user-helpers';
import { RegistrarSemAcessoVistoria } from '../registrar-sem-acesso';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { FocoRiscoReadRepository } from '../../../foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../../foco-risco/repositories/foco-risco-write.repository';
import { RecalcularScorePrioridadeFoco } from '../../../foco-risco/use-cases/recalcular-score-prioridade-foco';

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
  let recalcularScore: jest.Mocked<RecalcularScorePrioridadeFoco>;

  beforeEach(async () => {
    const vistoriaReadMock = { findById: jest.fn() };
    const vistoriaWriteMock = { save: jest.fn() };
    const focoReadMock = { findById: jest.fn() };
    const focoWriteMock = {
      save: jest.fn(),
      createHistorico: jest.fn().mockResolvedValue(HISTORICO_STUB),
      updateScorePrioridade: jest.fn(),
    };
    const recalcularScoreMock = { execute: jest.fn().mockResolvedValue({ score: 25 }) };
    const requestMock = mockRequest({ tenantId: 'cliente-1', user: { id: 'user-1', papeis: ['agente'] } as any });

    const module = await Test.createTestingModule({
      providers: [
        RegistrarSemAcessoVistoria,
        { provide: VistoriaReadRepository, useValue: vistoriaReadMock },
        { provide: VistoriaWriteRepository, useValue: vistoriaWriteMock },
        { provide: FocoRiscoReadRepository, useValue: focoReadMock },
        { provide: FocoRiscoWriteRepository, useValue: focoWriteMock },
        { provide: RecalcularScorePrioridadeFoco, useValue: recalcularScoreMock },
        { provide: REQUEST, useValue: requestMock },
      ],
    }).compile();

    useCase = module.get(RegistrarSemAcessoVistoria);
    vistoriaRead = module.get(VistoriaReadRepository);
    focoRead = module.get(FocoRiscoReadRepository);
    focoWrite = module.get(FocoRiscoWriteRepository);
    recalcularScore = module.get(RecalcularScorePrioridadeFoco);
  });

  it('fechado_ausente: transiciona para aguardando_nova_tentativa e calcula 1 dia útil', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'fechado_ausente', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(foco.tentativasSemAcesso).toBe(1);
    expect(result.proximaTentativa).toBeInstanceOf(Date);
    // fechado = 1 dia útil → não deve ser sábado/domingo
    const dia = (result.proximaTentativa as Date).getDay();
    expect(dia).not.toBe(0);
    expect(dia).not.toBe(6);
    // score recalculado via use-case oficial (inclui tentativas como fator permanente)
    expect(recalcularScore.execute).toHaveBeenCalledWith('foco-1');
    expect(focoWrite.updateScorePrioridade).not.toHaveBeenCalled();
  });

  it('recusa_entrada: score recalculado e histórico com motivo enriquecido', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ scorePrioridade: 30 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'recusa_entrada', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(recalcularScore.execute).toHaveBeenCalledWith('foco-1');
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoEvento: 'sem_acesso_registrado',
        motivo: expect.stringContaining('1/3'),
      }),
    );
  });

  it('fechado_viagem: score recalculado', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ scorePrioridade: 50 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'fechado_viagem', focoRiscoId: 'foco-1' });

    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(recalcularScore.execute).toHaveBeenCalledWith('foco-1');
  });

  it('calha_inacessivel: vai para aguardando_nova_tentativa + pendente_decisao_supervisor=true + sem data', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'calha_inacessivel', focoRiscoId: 'foco-1' });

    expect(foco.status).toBe('aguardando_nova_tentativa');
    expect(foco.pendentDecisaoSupervisor).toBe(true);
    expect(result.escaladoSupervisor).toBe(true);
    expect(result.proximaTentativa).toBeNull();
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'escalado_supervisor' }),
    );
  });

  it('3ª tentativa: escala supervisor automaticamente', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco({ tentativasSemAcesso: 2, scorePrioridade: 60 });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'recusa_entrada', focoRiscoId: 'foco-1' });

    expect(result.escaladoSupervisor).toBe(true);
    expect(foco.pendentDecisaoSupervisor).toBe(true);
    expect(foco.tentativasSemAcesso).toBe(3);
    expect(recalcularScore.execute).toHaveBeenCalledWith('foco-1');
  });

  it('retorno_planejado é registrado no histórico quando há data de retorno', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'recusa_entrada', focoRiscoId: 'foco-1' });

    const calls = focoWrite.createHistorico.mock.calls;
    expect(calls.length).toBe(2); // sem_acesso_registrado + retorno_planejado
    expect(calls[1][0]).toMatchObject({ tipoEvento: 'retorno_planejado' });
    expect(calls[1][0].motivo).toContain('Retorno planejado para');
  });

  it('calha_inacessivel: NÃO registra retorno_planejado (sem data)', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'calha_inacessivel', focoRiscoId: 'foco-1' });

    const calls = focoWrite.createHistorico.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toMatchObject({ tipoEvento: 'escalado_supervisor' });
  });

  it('sem focoRiscoId: só salva vistoria, não acessa repositório de foco', async () => {
    const vistoria = makeVistoria({ focoRiscoId: undefined });
    vistoriaRead.findById.mockResolvedValue(vistoria as never);

    const result = await useCase.execute('vistoria-1', { motivo: 'fechado_viagem' });

    expect(result.escaladoSupervisor).toBe(false);
    expect(focoRead.findById).not.toHaveBeenCalled();
    expect(recalcularScore.execute).not.toHaveBeenCalled();
  });

  it('não cria novo foco — focoId original é preservado', async () => {
    const vistoria = makeVistoria();
    const foco = makeFoco();
    vistoriaRead.findById.mockResolvedValue(vistoria as never);
    focoRead.findById.mockResolvedValue(foco as never);

    await useCase.execute('vistoria-1', { motivo: 'fechado_ausente', focoRiscoId: 'foco-1' });

    // nenhum create foi chamado — apenas save
    expect(focoWrite.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'foco-1' }));
  });
});
