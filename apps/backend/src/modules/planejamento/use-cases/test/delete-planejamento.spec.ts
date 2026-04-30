import { mock } from 'jest-mock-extended';

import { PlanejamentoReadRepository } from '../../repositories/planejamento-read.repository';
import { PlanejamentoWriteRepository } from '../../repositories/planejamento-write.repository';
import { DeletePlanejamento } from '../delete-planejamento';

const readRepo = mock<PlanejamentoReadRepository>();
const writeRepo = mock<PlanejamentoWriteRepository>();
const mockReq: any = {};

function makeUseCase() {
  return new DeletePlanejamento(readRepo, writeRepo, mockReq as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReq.user = { id: 'user-uuid' };
  mockReq.accessScope = { tenantId: null, clienteIdsPermitidos: null };
  writeRepo.softDelete.mockResolvedValue(undefined);
});

describe('DeletePlanejamento', () => {
  it('planejamento não encontrado → throw notFound', async () => {
    readRepo.findById.mockResolvedValue(null);
    await expect(makeUseCase().execute('any-id')).rejects.toMatchObject({
      response: { statusCode: 404 },
    });
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
  });

  it('tenant errado → 404 (DB filtra), softDelete não chamado', async () => {
    const plan = { id: 'plan-1', clienteId: 'cli-OWNER' } as any;
    readRepo.findById.mockImplementation(async (_id, clienteId) =>
      clienteId === 'cli-OWNER' ? plan : null,
    );
    mockReq.accessScope = { tenantId: 'cli-OTHER', clienteIdsPermitidos: ['cli-OTHER'] };

    await expect(makeUseCase().execute('plan-1')).rejects.toBeDefined();
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
  });

  it('tenant correto → softDelete chamado, retorna { deleted: true }', async () => {
    const plan = { id: 'plan-1', clienteId: 'cli-OWNER' } as any;
    readRepo.findById.mockResolvedValue(plan);
    mockReq.user = { id: 'user-uuid' };
    mockReq.accessScope = { tenantId: 'cli-OWNER', clienteIdsPermitidos: ['cli-OWNER'] };

    await expect(makeUseCase().execute('plan-1')).resolves.toMatchObject({ deleted: true });
    expect(writeRepo.softDelete).toHaveBeenCalledWith('plan-1', 'user-uuid');
  });
});
