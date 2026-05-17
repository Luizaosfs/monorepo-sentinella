import { Test, TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'jest-mock-extended';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { CasoNotificado } from '../../entities/notificacao';
import { NotificacaoWriteRepository } from '../../repositories/notificacao-write.repository';
import { CreateCaso } from '../create-caso';
import { CriarFocoDeCasoNotificado } from '../criar-foco-de-caso-notificado';
import {
  CruzarCasoComFocos,
  CruzarCasoComFocosResult,
} from '../cruzar-caso-com-focos';
import { ResolverAgentePorQuadra } from '../resolver-agente-por-quadra';
import { ResolverTerritorioPorCoordenada } from '../resolver-territorio-por-coordenada';

const SEM_TERRITORIO = {
  bairroId: null,
  bairroNome: null,
  quadraId: null,
  quadraCodigo: null,
};

const SEM_FOCO: CruzarCasoComFocosResult = {
  cruzamentos: 0,
  principalFocoId: null,
  principalDistanciaMetros: null,
};

const COM_FOCO: CruzarCasoComFocosResult = {
  cruzamentos: 1,
  principalFocoId: 'foco-uuid-1',
  principalDistanciaMetros: 42,
};

const makeCaso = (overrides: Partial<CasoNotificado> = {}): CasoNotificado =>
  ({
    id: 'caso-uuid-1',
    clienteId: 'cliente-uuid-1',
    latitude: -23.5,
    longitude: -46.6,
    regiaoId: undefined,
    status: 'suspeito',
    ...overrides,
  }) as unknown as CasoNotificado;

describe('CreateCaso', () => {
  let useCase: CreateCaso;
  const repository = mock<NotificacaoWriteRepository>();
  const cruzarCasoComFocos = mock<CruzarCasoComFocos>();
  const criarFocoDeCasoNotificado = mock<CriarFocoDeCasoNotificado>();
  const resolverTerritorio = mock<ResolverTerritorioPorCoordenada>();
  const resolverAgentePorQuadra = mock<ResolverAgentePorQuadra>();
  const enfileirarScore = {
    enfileirarPorCaso: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cruzarCasoComFocos.execute.mockResolvedValue(SEM_FOCO);
    criarFocoDeCasoNotificado.execute.mockResolvedValue({
      focoId: 'foco-novo-uuid',
    });
    resolverTerritorio.execute.mockResolvedValue(SEM_TERRITORIO);
    resolverAgentePorQuadra.execute.mockResolvedValue({
      agenteId: null,
      agenteNome: null,
    });
    enfileirarScore.enfileirarPorCaso.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCaso,
        { provide: NotificacaoWriteRepository, useValue: repository },
        { provide: CruzarCasoComFocos, useValue: cruzarCasoComFocos },
        {
          provide: CriarFocoDeCasoNotificado,
          useValue: criarFocoDeCasoNotificado,
        },
        {
          provide: ResolverTerritorioPorCoordenada,
          useValue: resolverTerritorio,
        },
        { provide: ResolverAgentePorQuadra, useValue: resolverAgentePorQuadra },
        { provide: EnfileirarScoreImovel, useValue: enfileirarScore },
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    useCase = module.get<CreateCaso>(CreateCaso);
  });

  it('deve criar caso e retorná-lo', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(result.caso).toBe(caso);
    expect(repository.createCaso).toHaveBeenCalledTimes(1);
  });

  it('cria foco epidemiológico quando nenhum foco existente foi encontrado', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    cruzarCasoComFocos.execute.mockResolvedValue(SEM_FOCO);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(criarFocoDeCasoNotificado.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        casoId: 'caso-uuid-1',
        clienteId: 'cliente-uuid-1',
      }),
    );
  });

  it('passa statusCaso do caso criado para CriarFocoDeCasoNotificado', async () => {
    const casoSuspeito = makeCaso({ status: 'suspeito' });
    repository.createCaso.mockResolvedValue(casoSuspeito);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(criarFocoDeCasoNotificado.execute).toHaveBeenCalledWith(
      expect.objectContaining({ statusCaso: 'suspeito' }),
    );
  });

  it('passa statusCaso=confirmado para CriarFocoDeCasoNotificado quando caso é confirmado', async () => {
    const casoConfirmado = makeCaso({ status: 'confirmado' });
    repository.createCaso.mockResolvedValue(casoConfirmado);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(criarFocoDeCasoNotificado.execute).toHaveBeenCalledWith(
      expect.objectContaining({ statusCaso: 'confirmado' }),
    );
  });

  it('NÃO cria foco epidemiológico quando foco existente foi encontrado', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    cruzarCasoComFocos.execute.mockResolvedValue(COM_FOCO);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(criarFocoDeCasoNotificado.execute).not.toHaveBeenCalled();
  });

  it('enfileira score por caso quando latitude e longitude presentes', async () => {
    const caso = makeCaso({ latitude: -23.5, longitude: -46.6 });
    repository.createCaso.mockResolvedValue(caso);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(enfileirarScore.enfileirarPorCaso).toHaveBeenCalledWith(
      'caso-uuid-1',
      'cliente-uuid-1',
    );
  });

  it('NÃO enfileira score quando latitude é null', async () => {
    const caso = makeCaso({ latitude: null as any, longitude: -46.6 });
    repository.createCaso.mockResolvedValue(caso);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(enfileirarScore.enfileirarPorCaso).not.toHaveBeenCalled();
  });

  it('falha no hook enfileirarScore NÃO interrompe a criação do caso', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    enfileirarScore.enfileirarPorCaso.mockRejectedValueOnce(
      new Error('job_queue down'),
    );

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(result.caso).toBeDefined();
  });

  it('falha no hook CruzarCasoComFocos NÃO interrompe a criação', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    cruzarCasoComFocos.execute.mockRejectedValueOnce(new Error('geo falhou'));

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(result.caso).toBeDefined();
  });

  it('falha no hook CriarFocoDeCasoNotificado NÃO interrompe a criação', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    cruzarCasoComFocos.execute.mockResolvedValue(SEM_FOCO);
    criarFocoDeCasoNotificado.execute.mockRejectedValueOnce(
      new Error('foco falhou'),
    );

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(result.caso).toBeDefined();
  });

  it('resolve bairro+quadra+agente e persiste no caso + propaga ao foco', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    resolverTerritorio.execute.mockResolvedValue({
      bairroId: 'bairro-1',
      bairroNome: 'Centro',
      quadraId: 'quadra-1',
      quadraCodigo: 'Q-007',
    });
    resolverAgentePorQuadra.execute.mockResolvedValue({
      agenteId: 'agente-1',
      agenteNome: 'João',
    });

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(resolverAgentePorQuadra.execute).toHaveBeenCalledWith(
      'cliente-uuid-1',
      'quadra-1',
    );
    expect(repository.vincularTerritorio).toHaveBeenCalledWith('caso-uuid-1', {
      bairroId: 'bairro-1',
      quadraId: 'quadra-1',
    });
    expect(criarFocoDeCasoNotificado.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        bairroId: 'bairro-1',
        quadraId: 'quadra-1',
        responsavelId: 'agente-1',
      }),
    );
    expect(result.territorio).toEqual({
      bairroId: 'bairro-1',
      bairroNome: 'Centro',
      quadraId: 'quadra-1',
      quadraCodigo: 'Q-007',
    });
    expect(result.agente).toEqual({ id: 'agente-1', nome: 'João' });
  });

  it('sem quadra resolvida NÃO chama resolverAgentePorQuadra', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    resolverTerritorio.execute.mockResolvedValue({
      bairroId: 'bairro-1',
      bairroNome: 'Centro',
      quadraId: null,
      quadraCodigo: null,
    });

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(resolverAgentePorQuadra.execute).not.toHaveBeenCalled();
  });

  it('falha na resolução territorial NÃO interrompe a criação do caso', async () => {
    const caso = makeCaso();
    repository.createCaso.mockResolvedValue(caso);
    resolverTerritorio.execute.mockRejectedValueOnce(new Error('postgis caiu'));

    const result = await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(result.caso).toBeDefined();
  });
});
