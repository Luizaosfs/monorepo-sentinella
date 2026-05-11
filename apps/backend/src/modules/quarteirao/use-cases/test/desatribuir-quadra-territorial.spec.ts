import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { DesatribuirQuadraTerritorial } from '../desatribuir-quadra-territorial';

const CLIENTE = 'aaaaaaaa-0000-4000-8000-000000000002';
const QUADRA  = 'dddddddd-0000-4000-8000-000000000002';

describe('DesatribuirQuadraTerritorial', () => {
  let useCase: DesatribuirQuadraTerritorial;
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesatribuirQuadraTerritorial,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: CLIENTE }) },
      ],
    }).compile();

    useCase = await module.resolve<DesatribuirQuadraTerritorial>(DesatribuirQuadraTerritorial);
  });

  it('deve desatribuir quadra territorial e retornar { ok: true }', async () => {
    writeRepo.desatribuirQuadraTerritorial.mockResolvedValue({ removida: true });

    const result = await useCase.execute(QUADRA);

    expect(result).toEqual({ ok: true });
    expect(writeRepo.desatribuirQuadraTerritorial).toHaveBeenCalledWith({
      clienteId: CLIENTE,
      quadraId: QUADRA,
    });
  });

  it('deve lançar distribuicaoTerritorialNotFound quando não há distribuição territorial', async () => {
    writeRepo.desatribuirQuadraTerritorial.mockResolvedValue({ removida: false });

    await expectHttpException(
      () => useCase.execute(QUADRA),
      QuarteiraoException.distribuicaoTerritorialNotFound(),
    );
  });

  it('deve preservar histórico por ciclo — repo só deleta onde ciclo_id IS NULL', async () => {
    writeRepo.desatribuirQuadraTerritorial.mockResolvedValue({ removida: true });

    await useCase.execute(QUADRA);

    // desatribuirQuadraTerritorial é chamado uma vez; não há chamada a deleteDistribuicao
    expect(writeRepo.desatribuirQuadraTerritorial).toHaveBeenCalledTimes(1);
    expect(writeRepo.deleteDistribuicao).not.toHaveBeenCalled();
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesatribuirQuadraTerritorial,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = await module.resolve<DesatribuirQuadraTerritorial>(DesatribuirQuadraTerritorial);

    await expectHttpException(
      () => uc.execute(QUADRA),
      QuarteiraoException.badRequest(),
    );
    expect(writeRepo.desatribuirQuadraTerritorial).not.toHaveBeenCalled();
  });

  it('deve chamar o repo com o clienteId do tenant (cross-tenant: quadra de outro cliente retorna removida: false)', async () => {
    writeRepo.desatribuirQuadraTerritorial.mockResolvedValue({ removida: false });

    await expectHttpException(
      () => useCase.execute(QUADRA),
      QuarteiraoException.distribuicaoTerritorialNotFound(),
    );
    // repo recebe o clienteId correto — a proteção cross-tenant é pela query do repo
    expect(writeRepo.desatribuirQuadraTerritorial).toHaveBeenCalledWith({
      clienteId: CLIENTE,
      quadraId: QUADRA,
    });
  });
});
