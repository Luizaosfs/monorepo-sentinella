import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { FecharSlaAoResolverFoco } from '../fechar-sla-ao-resolver-foco';

describe('FecharSlaAoResolverFoco', () => {
  let useCase: FecharSlaAoResolverFoco;
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FecharSlaAoResolverFoco,
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get(FecharSlaAoResolverFoco);
  });

  it('delega para writeRepo.fecharTodosPorFoco e repassa tx', async () => {
    writeRepo.fecharTodosPorFoco.mockResolvedValue(3);
    const tx = { mock: 'tx' };

    const count = await useCase.execute('foco-x', tx);

    expect(writeRepo.fecharTodosPorFoco).toHaveBeenCalledWith('foco-x', tx);
    expect(count).toBe(3);
  });

  it('idempotente: retorna 0 quando nada havia para fechar', async () => {
    writeRepo.fecharTodosPorFoco.mockResolvedValue(0);

    const count = await useCase.execute('foco-sem-sla');

    expect(count).toBe(0);
  });
});
