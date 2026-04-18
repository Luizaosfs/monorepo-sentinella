import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { Plano } from '../../entities/billing';
import { BillingWriteRepository } from '../../repositories/billing-write.repository';
import { CreatePlano } from '../create-plano';

describe('CreatePlano', () => {
  let useCase: CreatePlano;
  const writeRepo = mock<BillingWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePlano,
        { provide: BillingWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<CreatePlano>(CreatePlano);
  });

  it('deve criar plano aplicando defaults (droneHabilitado=false, ativo=true, ordem=0)', async () => {
    const entity = new Plano(
      {
        nome: 'Starter',
        droneHabilitado: false,
        slaAvancado: false,
        integracoesHabilitadas: [],
        ativo: true,
        ordem: 0,
      },
      {},
    );
    writeRepo.createPlano.mockResolvedValue(entity);

    const result = await useCase.execute({ nome: 'Starter' } as any);

    expect(result.plano.ativo).toBe(true);
    expect(result.plano.droneHabilitado).toBe(false);
    expect(result.plano.ordem).toBe(0);
  });

  it('deve propagar erro do repository', async () => {
    writeRepo.createPlano.mockRejectedValue(new Error('unique-nome'));

    await expect(useCase.execute({ nome: 'Duplicado' } as any)).rejects.toThrow(
      'unique-nome',
    );
  });
});
