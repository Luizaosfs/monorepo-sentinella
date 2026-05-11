import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { AtribuirQuadraTerritorial } from '../atribuir-quadra-territorial';
import { DistribuicaoBuilder } from './builders/quarteirao.builder';

const CLIENTE  = 'aaaaaaaa-0000-4000-8000-000000000001';
const QUADRA   = 'dddddddd-0000-4000-8000-000000000001';
const AGENTE   = 'bbbbbbbb-0000-4000-8000-000000000001';
const AGENTE_2 = 'cccccccc-0000-4000-8000-000000000001';

const quadraMock = { id: QUADRA, bairro_id: null };

const prismaMock = {
  client: {
    bairros_quadras: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
} as any;

describe('AtribuirQuadraTerritorial', () => {
  let useCase: AtribuirQuadraTerritorial;
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.client.bairros_quadras.findFirst.mockResolvedValue(quadraMock);
    prismaMock.client.$queryRaw.mockResolvedValue([{ id: AGENTE }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirQuadraTerritorial,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: PrismaService, useValue: prismaMock },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: CLIENTE }) },
      ],
    }).compile();

    useCase = await module.resolve<AtribuirQuadraTerritorial>(AtribuirQuadraTerritorial);
  });

  it('deve atribuir quadra a agente sem ciclo (ciclo_id = null)', async () => {
    const dist = new DistribuicaoBuilder().withCicloIdNull().withQuadraId(QUADRA).withAgenteId(AGENTE).build();
    writeRepo.atribuirQuadraTerritorial.mockResolvedValue(dist);

    const result = await useCase.execute({ quadraId: QUADRA, agenteId: AGENTE });

    expect(result.distribuicao.cicloId).toBeNull();
    expect(result.distribuicao.quadraId).toBe(QUADRA);
    expect(result.distribuicao.agenteId).toBe(AGENTE);
    expect(writeRepo.atribuirQuadraTerritorial).toHaveBeenCalledWith({
      clienteId: CLIENTE,
      quadraId: QUADRA,
      agenteId: AGENTE,
      bairroId: undefined,
    });
  });

  it('deve transferir quadra entre agentes (upsert — mesmo quadraId, agente diferente)', async () => {
    const distAtualizada = new DistribuicaoBuilder()
      .withCicloIdNull()
      .withQuadraId(QUADRA)
      .withAgenteId(AGENTE_2)
      .build();
    writeRepo.atribuirQuadraTerritorial.mockResolvedValue(distAtualizada);
    prismaMock.client.$queryRaw.mockResolvedValue([{ id: AGENTE_2 }]);

    const result = await useCase.execute({ quadraId: QUADRA, agenteId: AGENTE_2 });

    expect(result.distribuicao.agenteId).toBe(AGENTE_2);
    expect(result.distribuicao.cicloId).toBeNull();
    expect(writeRepo.atribuirQuadraTerritorial).toHaveBeenCalledTimes(1);
  });

  it('deve rejeitar quadra de outro cliente (quadra não encontrada para o tenant)', async () => {
    prismaMock.client.bairros_quadras.findFirst.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ quadraId: QUADRA, agenteId: AGENTE }),
      QuarteiraoException.notFound(),
    );
    expect(writeRepo.atribuirQuadraTerritorial).not.toHaveBeenCalled();
  });

  it('deve rejeitar quadra deletada (mesma lógica: findFirst retorna null)', async () => {
    prismaMock.client.bairros_quadras.findFirst.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ quadraId: QUADRA, agenteId: AGENTE }),
      QuarteiraoException.notFound(),
    );
  });

  it('deve rejeitar agente de outro cliente (não aparece no $queryRaw)', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([]);

    await expectHttpException(
      () => useCase.execute({ quadraId: QUADRA, agenteId: AGENTE }),
      QuarteiraoException.agenteNotFound(),
    );
    expect(writeRepo.atribuirQuadraTerritorial).not.toHaveBeenCalled();
  });

  it('deve rejeitar agente inativo (u.ativo = false — $queryRaw retorna vazio)', async () => {
    prismaMock.client.$queryRaw.mockResolvedValue([]);

    await expectHttpException(
      () => useCase.execute({ quadraId: QUADRA, agenteId: AGENTE }),
      QuarteiraoException.agenteNotFound(),
    );
    expect(writeRepo.atribuirQuadraTerritorial).not.toHaveBeenCalled();
  });

  it('deve rejeitar clienteId ausente (tenantId vazio)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirQuadraTerritorial,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: PrismaService, useValue: prismaMock },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = await module.resolve<AtribuirQuadraTerritorial>(AtribuirQuadraTerritorial);

    await expectHttpException(
      () => uc.execute({ quadraId: QUADRA, agenteId: AGENTE }),
      QuarteiraoException.badRequest(),
    );
    expect(writeRepo.atribuirQuadraTerritorial).not.toHaveBeenCalled();
  });

  it('deve passar bairroId da quadra para o repositório quando presente', async () => {
    const BAIRRO = 'eeeeeeee-0000-4000-8000-000000000001';
    prismaMock.client.bairros_quadras.findFirst.mockResolvedValue({
      id: QUADRA,
      bairro_id: BAIRRO,
    });
    const dist = new DistribuicaoBuilder().withCicloIdNull().build();
    writeRepo.atribuirQuadraTerritorial.mockResolvedValue(dist);

    await useCase.execute({ quadraId: QUADRA, agenteId: AGENTE });

    expect(writeRepo.atribuirQuadraTerritorial).toHaveBeenCalledWith(
      expect.objectContaining({ bairroId: BAIRRO }),
    );
  });
});
