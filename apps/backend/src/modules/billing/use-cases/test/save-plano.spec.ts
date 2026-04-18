import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { Plano } from '../../entities/billing';
import { BillingException } from '../../errors/billing.exception';
import { BillingReadRepository } from '../../repositories/billing-read.repository';
import { BillingWriteRepository } from '../../repositories/billing-write.repository';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { SavePlano } from '../save-plano';

describe('SavePlano', () => {
  let useCase: SavePlano;
  const readRepo = mock<BillingReadRepository>();
  const writeRepo = mock<BillingWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavePlano,
        { provide: BillingReadRepository, useValue: readRepo },
        { provide: BillingWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<SavePlano>(SavePlano);
  });

  it('deve atualizar campos fornecidos e persistir via writeRepo', async () => {
    const plano = new Plano(
      {
        nome: 'Starter',
        descricao: 'old',
        precoMensal: 100,
        droneHabilitado: false,
        slaAvancado: false,
        integracoesHabilitadas: [],
        ativo: true,
        ordem: 0,
      },
      { id: 'plano-1' },
    );
    readRepo.findPlanoById.mockResolvedValue(plano);
    writeRepo.savePlano.mockResolvedValue();

    const result = await useCase.execute('plano-1', {
      nome: 'Starter Plus',
      precoMensal: 150,
      ativo: false,
    } as any);

    expect(result.plano.nome).toBe('Starter Plus');
    expect(result.plano.precoMensal).toBe(150);
    expect(result.plano.ativo).toBe(false);
    expect(writeRepo.savePlano).toHaveBeenCalledWith(plano);
  });

  it('deve lançar planoNotFound quando id não existe', async () => {
    readRepo.findPlanoById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('inexistente', { nome: 'X' } as any),
      BillingException.planoNotFound(),
    );
  });
});
