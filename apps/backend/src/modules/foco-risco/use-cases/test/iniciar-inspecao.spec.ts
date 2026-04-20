import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { IniciarInspecao } from '../iniciar-inspecao';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('IniciarInspecao', () => {
  let useCase: IniciarInspecao;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciarInspecao,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cliente-uuid-1', user: { id: 'agente-uuid-1' } as never }) },
      ],
    }).compile();

    useCase = module.get<IniciarInspecao>(IniciarInspecao);
  });

  it('deve mudar aguarda_inspecao → em_inspecao e preencher inspecaoEm', async () => {
    const foco = new FocoRiscoBuilder().withStatus('aguarda_inspecao').withResponsavelId('agente-uuid-1').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_inspecao',
    });

    const result = await useCase.execute(foco.id!, { observacao: 'iniciando' });

    expect(result.foco.status).toBe('em_inspecao');
    expect(result.foco.inspecaoEm).toBeInstanceOf(Date);
    expect(result.foco.observacao).toBe('iniciando');
    expect(writeRepo.save).toHaveBeenCalledTimes(1);
    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        statusAnterior: 'aguarda_inspecao',
        statusNovo: 'em_inspecao',
        tipoEvento: 'inicio_inspecao',
      }),
    );
  });

  it('deve rejeitar se status != aguarda_inspecao', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').withResponsavelId('agente-uuid-1').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => useCase.execute(foco.id!, {}),
      FocoRiscoException.statusInvalido(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar se foco não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', {}),
      FocoRiscoException.notFound(),
    );
  });

  it('deve rejeitar agente sem responsável atribuído no foco', async () => {
    const reqAgente = mockRequest({
      user: {
        id: 'agente-1',
        email: 'a@t.com',
        nome: 'Agente',
        clienteId: 'cliente-uuid-1',
        papeis: ['agente'],
      },
      tenantId: 'cliente-uuid-1',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciarInspecao,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: reqAgente },
      ],
    }).compile();
    const uc = module.get<IniciarInspecao>(IniciarInspecao);

    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => uc.execute(foco.id!, {}),
      FocoRiscoException.inicioInspecaoSemResponsavel(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve permitir ao agente responsável iniciar inspeção', async () => {
    const reqAgente = mockRequest({
      user: {
        id: 'agente-1',
        email: 'a@t.com',
        nome: 'Agente',
        clienteId: 'cliente-uuid-1',
        papeis: ['agente'],
      },
      tenantId: 'cliente-uuid-1',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciarInspecao,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: reqAgente },
      ],
    }).compile();
    const uc = module.get<IniciarInspecao>(IniciarInspecao);

    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .withResponsavelId('agente-1')
      .build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: foco.clienteId,
      statusNovo: 'em_inspecao',
    });

    const result = await uc.execute(foco.id!, {});

    expect(result.foco.status).toBe('em_inspecao');
    expect(writeRepo.save).toHaveBeenCalled();
  });

  it('deve rejeitar agente que não é o responsável', async () => {
    const reqAgente = mockRequest({
      user: {
        id: 'outro-agente',
        email: 'a@t.com',
        nome: 'Agente',
        clienteId: 'cliente-uuid-1',
        papeis: ['agente'],
      },
      tenantId: 'cliente-uuid-1',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciarInspecao,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: reqAgente },
      ],
    }).compile();
    const uc = module.get<IniciarInspecao>(IniciarInspecao);

    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .withResponsavelId('agente-1')
      .build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => uc.execute(foco.id!, {}),
      FocoRiscoException.inicioInspecaoApenasResponsavel(),
    );
  });
});
