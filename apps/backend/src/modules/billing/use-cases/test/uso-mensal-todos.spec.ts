import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteQuotas } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';
import { UsoMensalTodos } from '../uso-mensal-todos';

describe('UsoMensalTodos', () => {
  let useCase: UsoMensalTodos;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsoMensalTodos,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<UsoMensalTodos>(UsoMensalTodos);
  });

  it('deve retornar uso+limites de cada cliente', async () => {
    readRepo.findUsoMensalTodos.mockResolvedValue([
      {
        clienteId: 'cli-1',
        voosMes: 2,
        levantamentosMes: 4,
        itensMes: 10,
        usuariosAtivos: 1,
      },
      {
        clienteId: 'cli-2',
        voosMes: 0,
        levantamentosMes: 0,
        itensMes: 0,
        usuariosAtivos: 0,
      },
    ]);
    readRepo.findQuotas
      .mockResolvedValueOnce(
        new ClienteQuotas(
          {
            clienteId: 'cli-1',
            voosMes: 10,
            levantamentosMes: 20,
            itensMes: 30,
            usuariosAtivos: 2,
          },
          {},
        ),
      )
      .mockResolvedValueOnce(null);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0].limites).toEqual({
      voosMes: 10,
      levantamentosMes: 20,
      itensMes: 30,
      usuariosAtivos: 2,
    });
    expect(result[1].limites).toEqual({
      voosMes: null,
      levantamentosMes: null,
      itensMes: null,
      usuariosAtivos: null,
    });
  });

  it('deve retornar lista vazia quando nenhum cliente tem uso', async () => {
    readRepo.findUsoMensalTodos.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
    expect(readRepo.findQuotas).not.toHaveBeenCalled();
  });
});
