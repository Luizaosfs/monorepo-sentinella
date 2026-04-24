import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { NotificacaoWriteRepository } from '../../repositories/notificacao-write.repository';
import { CruzarCasoComFocos } from '../cruzar-caso-com-focos';
import { CreateCaso } from '../create-caso';
import { CasoNotificado } from '../../entities/notificacao';

const makeCaso = (overrides: Partial<CasoNotificado> = {}): CasoNotificado =>
  ({
    id: 'caso-uuid-1',
    clienteId: 'cliente-uuid-1',
    latitude: -23.5,
    longitude: -46.6,
    ...overrides,
  }) as unknown as CasoNotificado;

describe('CreateCaso', () => {
  let useCase: CreateCaso;
  const repository = mock<NotificacaoWriteRepository>();
  const cruzarCasoComFocos = mock<CruzarCasoComFocos>();
  const enfileirarScore = { enfileirarPorCaso: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    cruzarCasoComFocos.execute.mockResolvedValue({ cruzamentos: 0 });
    enfileirarScore.enfileirarPorCaso.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCaso,
        { provide: NotificacaoWriteRepository, useValue: repository },
        { provide: CruzarCasoComFocos, useValue: cruzarCasoComFocos },
        { provide: EnfileirarScoreImovel, useValue: enfileirarScore },
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

  it('enfileira score por caso quando latitude e longitude presentes', async () => {
    const caso = makeCaso({ latitude: -23.5, longitude: -46.6 });
    repository.createCaso.mockResolvedValue(caso);

    await useCase.execute('cliente-uuid-1', 'user-1', {} as any);

    expect(enfileirarScore.enfileirarPorCaso).toHaveBeenCalledWith('caso-uuid-1', 'cliente-uuid-1');
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
    enfileirarScore.enfileirarPorCaso.mockRejectedValueOnce(new Error('job_queue down'));

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
});
