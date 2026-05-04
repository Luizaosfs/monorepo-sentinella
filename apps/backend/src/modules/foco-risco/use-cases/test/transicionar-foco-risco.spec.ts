import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { mock } from 'jest-mock-extended';

import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { CancelarReinspecoesAoFecharFoco } from '../../../reinspecao/use-cases/cancelar-reinspecoes-ao-fechar-foco';
import { CriarReinspecaoPosTratamento } from '../../../reinspecao/use-cases/criar-reinspecao-pos-tratamento';
import { SlaWriteRepository } from '../../../sla/repositories/sla-write.repository';
import { FecharSlaAoResolverFoco } from '../../../sla/use-cases/fechar-sla-ao-resolver-foco';
import { IniciarSlaAoConfirmarFoco } from '../../../sla/use-cases/iniciar-sla-ao-confirmar-foco';
import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { TransicionarFocoRisco } from '../transicionar-foco-risco';
import { RecalcularScorePrioridadeFoco } from '../recalcular-score-prioridade-foco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('TransicionarFocoRisco', () => {
  let useCase: TransicionarFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();
  const iniciarSla = mock<IniciarSlaAoConfirmarFoco>();
  const fecharSla = mock<FecharSlaAoResolverFoco>();
  const slaWriteRepo = mock<SlaWriteRepository>();
  const criarReinspecao = mock<CriarReinspecaoPosTratamento>();
  const cancelarReinspecoes = mock<CancelarReinspecoesAoFecharFoco>();
  const recalcularScore = mock<RecalcularScorePrioridadeFoco>();
  const enfileirarScore = { enfileirarPorImovel: jest.fn().mockResolvedValue(undefined) };

  /**
   * Mock de PrismaService suficiente para `client.$transaction(callback)` —
   * o callback roda imediatamente com um tx-mock opaco (simula commit).
   */
  const prismaMock = {
    client: {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({ __mock_tx__: true });
      }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.client.$transaction = jest.fn(async (cb) =>
      cb({ __mock_tx__: true }),
    );
    recalcularScore.execute.mockResolvedValue({ score: 30 });
    enfileirarScore.enfileirarPorImovel.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransicionarFocoRisco,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: IniciarSlaAoConfirmarFoco, useValue: iniciarSla },
        { provide: FecharSlaAoResolverFoco, useValue: fecharSla },
        { provide: SlaWriteRepository, useValue: slaWriteRepo },
        { provide: CriarReinspecaoPosTratamento, useValue: criarReinspecao },
        { provide: CancelarReinspecoesAoFecharFoco, useValue: cancelarReinspecoes },
        { provide: RecalcularScorePrioridadeFoco, useValue: recalcularScore },
        { provide: EnfileirarScoreImovel, useValue: enfileirarScore },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cliente-uuid-1' }) },
      ],
    }).compile();

    useCase = module.get<TransicionarFocoRisco>(TransicionarFocoRisco);
  });

  it('deve transicionar suspeita → em_triagem (sem SLA hooks)', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });

    const result = await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(result.foco.status).toBe('em_triagem');
    expect(result.sla).toBeNull();
    expect(result.slaFechados).toBeNull();
    expect(iniciarSla.execute).not.toHaveBeenCalled();
    expect(fecharSla.execute).not.toHaveBeenCalled();
  });

  it('em_tratamento → resolvido chama FecharSla e preenche resolvidoEm', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'resolvido',
    });
    fecharSla.execute.mockResolvedValue(2);

    const result = await useCase.execute(foco.id!, {
      statusPara: 'resolvido',
      desfecho: 'Tratamento concluído',
    });

    expect(result.foco.status).toBe('resolvido');
    expect(result.foco.resolvidoEm).toBeInstanceOf(Date);
    expect(fecharSla.execute).toHaveBeenCalledWith(foco.id, expect.anything());
    expect(result.slaFechados).toBe(2);
  });

  it('em_inspecao → confirmado chama IniciarSla e preenche confirmadoEm', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'confirmado',
    });
    iniciarSla.execute.mockResolvedValue({
      acao: 'criado',
      slaId: 'sla-novo',
      fromFallback: false,
    });

    const result = await useCase.execute(foco.id!, { statusPara: 'confirmado' });

    expect(result.foco.confirmadoEm).toBeInstanceOf(Date);
    expect(iniciarSla.execute).toHaveBeenCalledWith(foco, expect.anything());
    expect(result.sla).toEqual({ acao: 'criado', slaId: 'sla-novo', fromFallback: false });
  });

  it('confirmado → em_tratamento chama CriarReinspecaoPosTratamento', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_tratamento',
    });
    criarReinspecao.execute.mockResolvedValue({
      acao: 'criada',
      reinspecaoId: 'reinsp-1',
      dataPrevista: new Date('2026-05-01'),
    });

    const result = await useCase.execute(foco.id!, {
      statusPara: 'em_tratamento',
    });

    expect(result.foco.status).toBe('em_tratamento');
    expect(criarReinspecao.execute).toHaveBeenCalledWith(foco, expect.anything());
    expect(iniciarSla.execute).not.toHaveBeenCalled();
    expect(fecharSla.execute).not.toHaveBeenCalled();
    expect(result.reinspecao).toEqual(
      expect.objectContaining({ acao: 'criada', reinspecaoId: 'reinsp-1' }),
    );
  });

  it('em_tratamento → resolvido cancela reinspeções pendentes', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'resolvido',
    });
    fecharSla.execute.mockResolvedValue(1);
    cancelarReinspecoes.execute.mockResolvedValue(3);

    const result = await useCase.execute(foco.id!, { statusPara: 'resolvido' });

    expect(cancelarReinspecoes.execute).toHaveBeenCalledWith(
      foco.id,
      'test-user-id',
      expect.anything(),
    );
    expect(result.reinspecoesCanceladas).toBe(3);
    expect(result.slaFechados).toBe(1);
  });

  it('compensação: erro no CriarReinspecao NÃO bloqueia foco+histórico', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_tratamento',
    });
    criarReinspecao.execute.mockRejectedValue(new Error('reinspecao falhou'));
    slaWriteRepo.registrarErroCriacao.mockResolvedValue();

    const result = await useCase.execute(foco.id!, {
      statusPara: 'em_tratamento',
    });

    expect(writeRepo.save).toHaveBeenCalled();
    expect(writeRepo.createHistorico).toHaveBeenCalled();
    expect(result.foco.status).toBe('em_tratamento');
    expect(result.reinspecao).toBeNull();
    expect(result.slaError).toContain('reinspecao falhou');

    await new Promise((r) => setImmediate(r));
    expect(slaWriteRepo.registrarErroCriacao).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: foco.clienteId,
        focoRiscoId: foco.id,
        erro: 'reinspecao falhou',
      }),
    );
  });

  it('em_triagem → descartado chama FecharSla também', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_triagem').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'descartado',
    });
    fecharSla.execute.mockResolvedValue(0);

    const result = await useCase.execute(foco.id!, { statusPara: 'descartado' });

    expect(result.foco.resolvidoEm).toBeInstanceOf(Date);
    expect(fecharSla.execute).toHaveBeenCalledWith(foco.id, expect.anything());
    expect(result.slaFechados).toBe(0);
  });

  it('compensação: erro no IniciarSla NÃO bloqueia foco+histórico e registra em sla_erros_criacao', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'confirmado',
    });
    iniciarSla.execute.mockRejectedValue(new Error('config corrompida'));
    slaWriteRepo.registrarErroCriacao.mockResolvedValue();

    const result = await useCase.execute(foco.id!, { statusPara: 'confirmado' });

    // Foco salvou e histórico foi criado apesar do erro de SLA
    expect(writeRepo.save).toHaveBeenCalled();
    expect(writeRepo.createHistorico).toHaveBeenCalled();
    expect(result.foco.status).toBe('confirmado');
    expect(result.sla).toBeNull();
    expect(result.slaError).toContain('config corrompida');

    // Aguarda o microtask do .catch() no registrarErroCriacao
    await new Promise((r) => setImmediate(r));
    expect(slaWriteRepo.registrarErroCriacao).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: foco.clienteId,
        focoRiscoId: foco.id,
        erro: 'config corrompida',
        contexto: expect.objectContaining({
          use_case: 'TransicionarFocoRisco',
          status_novo: 'confirmado',
        }),
      }),
    );
  });

  it('deve rejeitar aguarda_inspecao → em_inspecao (fluxo exclusivo de iniciar-inspecao)', async () => {
    const foco = new FocoRiscoBuilder().withStatus('aguarda_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () =>
        useCase.execute(foco.id!, {
          statusPara: 'em_inspecao' as never,
        }),
      FocoRiscoException.transicaoInvalida(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar transição inválida suspeita → confirmado', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => useCase.execute(foco.id!, { statusPara: 'confirmado' }),
      FocoRiscoException.transicaoInvalida(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
    expect(writeRepo.createHistorico).not.toHaveBeenCalled();
  });

  it('deve rejeitar foco não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { statusPara: 'em_triagem' }),
      FocoRiscoException.notFound(),
    );
  });

  it('chama RecalcularScorePrioridadeFoco após transição bem-sucedida', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });

    await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(recalcularScore.execute).toHaveBeenCalledWith(foco.id);
  });

  it('falha no RecalcularScore NÃO interrompe a transição', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });
    recalcularScore.execute.mockRejectedValueOnce(new Error('score db error'));

    const result = await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(result.foco.status).toBe('em_triagem');
    expect(writeRepo.save).toHaveBeenCalled();
    expect(writeRepo.createHistorico).toHaveBeenCalled();
  });

  it('deve gerar registro em historico com usuarioId do request', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });

    await useCase.execute(foco.id!, { statusPara: 'em_triagem', motivo: 'triagem inicial' });

    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        focoRiscoId: foco.id,
        clienteId: foco.clienteId,
        statusAnterior: 'suspeita',
        statusNovo: 'em_triagem',
        alteradoPor: 'test-user-id',
        motivo: 'triagem inicial',
        tipoEvento: 'mudanca_status',
      }),
      expect.anything(),
    );
  });

  it('enfileira score do imóvel após transição quando imovelId presente', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').withImovelId('imovel-uuid-1').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'em_triagem' });

    await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(enfileirarScore.enfileirarPorImovel).toHaveBeenCalledWith('imovel-uuid-1', 'cliente-uuid-1');
  });

  it('NÃO enfileira score quando foco não tem imovelId', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'em_triagem' });

    await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(enfileirarScore.enfileirarPorImovel).not.toHaveBeenCalled();
  });

  it('falha no hook enfileirarScore NÃO interrompe a transição', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').withImovelId('imovel-uuid-1').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'em_triagem' });
    enfileirarScore.enfileirarPorImovel.mockRejectedValueOnce(new Error('job_queue down'));

    const result = await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(result.foco.status).toBe('em_triagem');
  });

  describe('ownership — agente só transiciona foco atribuído a si', () => {
    async function buildWithRequest(reqOverrides: Parameters<typeof mockRequest>[0]) {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransicionarFocoRisco,
          { provide: PrismaService, useValue: prismaMock },
          { provide: FocoRiscoReadRepository, useValue: readRepo },
          { provide: FocoRiscoWriteRepository, useValue: writeRepo },
          { provide: IniciarSlaAoConfirmarFoco, useValue: iniciarSla },
          { provide: FecharSlaAoResolverFoco, useValue: fecharSla },
          { provide: SlaWriteRepository, useValue: slaWriteRepo },
          { provide: CriarReinspecaoPosTratamento, useValue: criarReinspecao },
          { provide: CancelarReinspecoesAoFecharFoco, useValue: cancelarReinspecoes },
          { provide: RecalcularScorePrioridadeFoco, useValue: recalcularScore },
          { provide: EnfileirarScoreImovel, useValue: enfileirarScore },
          { provide: REQUEST, useValue: mockRequest(reqOverrides) },
        ],
      }).compile();
      return module.get<TransicionarFocoRisco>(TransicionarFocoRisco);
    }

    beforeEach(() => {
      writeRepo.save.mockResolvedValue();
      writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'em_triagem' });
      recalcularScore.execute.mockResolvedValue({ score: 30 });
    });

    it('agente responsável pelo foco pode transicionar', async () => {
      const uc = await buildWithRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } });
      const foco = new FocoRiscoBuilder().withStatus('suspeita').withResponsavelId('agente-uuid').build();
      readRepo.findById.mockResolvedValue(foco);

      const result = await uc.execute(foco.id!, { statusPara: 'em_triagem' });

      expect(result.foco.status).toBe('em_triagem');
    });

    it('agente bloqueado se foco.responsavelId !== user.id', async () => {
      const uc = await buildWithRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } });
      const foco = new FocoRiscoBuilder().withStatus('suspeita').withResponsavelId('outro-agente').build();
      readRepo.findById.mockResolvedValue(foco);

      await expectHttpException(
        () => uc.execute(foco.id!, { statusPara: 'em_triagem' }),
        FocoRiscoException.semPermissaoTransicionar(),
      );
      expect(writeRepo.save).not.toHaveBeenCalled();
    });

    it('agente pode transicionar foco sem responsavelId definido', async () => {
      const uc = await buildWithRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } });
      const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
      readRepo.findById.mockResolvedValue(foco);

      const result = await uc.execute(foco.id!, { statusPara: 'em_triagem' });

      expect(result.foco.status).toBe('em_triagem');
    });

    it('supervisor pode transicionar foco de outro agente', async () => {
      const uc = await buildWithRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } });
      const foco = new FocoRiscoBuilder().withStatus('suspeita').withResponsavelId('outro-agente').build();
      readRepo.findById.mockResolvedValue(foco);

      const result = await uc.execute(foco.id!, { statusPara: 'em_triagem' });

      expect(result.foco.status).toBe('em_triagem');
    });

    it('admin (isPlatformAdmin) pode transicionar qualquer foco', async () => {
      const uc = await buildWithRequest({
        user: { id: 'admin-uuid', email: 'admin@test.com', nome: 'Admin', clienteId: 'test-cliente-id', papeis: ['admin'], isPlatformAdmin: true } as any,
      });
      const foco = new FocoRiscoBuilder().withStatus('suspeita').withResponsavelId('outro-agente').build();
      readRepo.findById.mockResolvedValue(foco);

      const result = await uc.execute(foco.id!, { statusPara: 'em_triagem' });

      expect(result.foco.status).toBe('em_triagem');
    });
  });
});

