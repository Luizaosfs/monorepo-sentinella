import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { PlanejamentoReadRepository } from '../../repositories/planejamento-read.repository';
import { PlanejamentoWriteRepository } from '../../repositories/planejamento-write.repository';
import { SavePlanejamento } from '../save-planejamento';

const readRepo = mock<PlanejamentoReadRepository>();
const writeRepo = mock<PlanejamentoWriteRepository>();
const mockReq: any = {};

function makeUseCase() {
  return new SavePlanejamento(readRepo, writeRepo, mockReq as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReq.user = { isPlatformAdmin: true };
  mockReq.tenantId = undefined;
  writeRepo.save.mockResolvedValue(undefined);
});

describe('SavePlanejamento', () => {
  it('planejamento não encontrado → throw notFound', async () => {
    readRepo.findById.mockResolvedValue(null);
    await expect(makeUseCase().execute('any-id', {})).rejects.toMatchObject({
      response: { statusCode: 404 },
    });
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('tenant errado → throw ForbiddenException, save não chamado', async () => {
    const plan = { id: 'plan-1', clienteId: 'cli-OWNER' } as any;
    readRepo.findById.mockResolvedValue(plan);
    mockReq.user = { isPlatformAdmin: false };
    mockReq.tenantId = 'cli-OTHER';

    await expect(makeUseCase().execute('plan-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('tenant correto → aplica patch e salva', async () => {
    const plan = { id: 'plan-1', clienteId: 'cli-OWNER', descricao: undefined, ativo: undefined } as any;
    readRepo.findById.mockResolvedValue(plan);
    mockReq.user = { isPlatformAdmin: false };
    mockReq.tenantId = 'cli-OWNER';

    const result = await makeUseCase().execute('plan-1', { descricao: 'nova desc' });

    expect(plan.descricao).toBe('nova desc');
    expect(writeRepo.save).toHaveBeenCalledWith(plan);
    expect(result.planejamento).toBe(plan);
  });
});
