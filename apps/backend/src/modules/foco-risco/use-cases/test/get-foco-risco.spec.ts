import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { GetFocoRisco } from '../get-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('GetFocoRisco', () => {
  let useCase: GetFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();
  const findFirstSla = jest.fn().mockResolvedValue(null);
  const findFirstCfg = jest.fn().mockResolvedValue(null);
  const findManyVistorias = jest.fn().mockResolvedValue([]);
  const findFirstVistoria = jest.fn().mockResolvedValue(null);
  const prisma = {
    client: {
      sla_operacional: { findFirst: findFirstSla },
      sla_foco_config: { findFirst: findFirstCfg },
      vistorias: { findMany: findManyVistorias, findFirst: findFirstVistoria },
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    findFirstSla.mockResolvedValue(null);
    findFirstCfg.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get<GetFocoRisco>(GetFocoRisco);
  });

  it('deve retornar foco com histórico e snapshot SLA', async () => {
    const foco = new FocoRiscoBuilder().withId('foco-1').build();
    readRepo.findByIdComHistorico.mockResolvedValue(foco);

    const result = await useCase.execute('foco-1');

    expect(result.foco).toBe(foco);
    expect(result.sla).toMatchObject({
      statusAtual: foco.status,
      faseSla: 'triagem',
    });
    expect(result.consolidacao?.origem.fonte).toBe('indisponivel');
    expect(findManyVistorias).toHaveBeenCalled();
    expect(readRepo.findByIdComHistorico).toHaveBeenCalledWith('foco-1', undefined);
  });

  it('deve rejeitar foco não encontrado', async () => {
    readRepo.findByIdComHistorico.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe'),
      FocoRiscoException.notFound(),
    );
  });

  it('deve buscar foco filtrando pelo clienteId (tenant isolation)', async () => {
    const tenantId = 'tenant-uuid-1';
    const foco = new FocoRiscoBuilder().withId('foco-1').build();
    readRepo.findByIdComHistorico.mockResolvedValue(foco);

    await useCase.execute('foco-1', tenantId);

    expect(readRepo.findByIdComHistorico).toHaveBeenCalledWith('foco-1', tenantId);
  });
});
