import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ListAlertasByAgente } from '../list-alertas-by-agente';

describe('ListAlertasByAgente', () => {
  let useCase: ListAlertasByAgente;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAlertasByAgente,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<ListAlertasByAgente>(ListAlertasByAgente);
  });

  it('retorna alertas não resolvidos do agente', async () => {
    const rows = [
      {
        id: 'alerta-1',
        agente_id: 'agente-uuid',
        motivo: 'reinfestação',
        resolvido: false,
        imovel_numero: '123',
        imovel_logradouro: 'Rua das Flores',
        imovel_bairro: 'Centro',
      },
    ];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await useCase.execute('cliente-uuid', 'agente-uuid');

    expect(result).toBe(rows);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna array vazio quando não há alertas pendentes', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-uuid', 'agente-sem-alertas');

    expect(result).toEqual([]);
  });
});
