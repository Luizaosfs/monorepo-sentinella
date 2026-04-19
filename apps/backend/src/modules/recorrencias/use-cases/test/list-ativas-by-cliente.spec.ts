import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ListAtivasByCliente } from '../list-ativas-by-cliente';

describe('ListAtivasByCliente', () => {
  let useCase: ListAtivasByCliente;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAtivasByCliente,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<ListAtivasByCliente>(ListAtivasByCliente);
  });

  it('retorna recorrências ativas do cliente', async () => {
    const rows = [
      {
        id: 'imovel-uuid-1',
        cliente_id: 'cliente-uuid',
        endereco_ref: 'imovel-uuid-1',
        total_ocorrencias: 3,
        primeira_ocorrencia_id: 'foco-1',
        ultima_ocorrencia_id: 'foco-3',
        primeira_ocorrencia_em: new Date('2026-03-20'),
        ultima_ocorrencia_em: new Date('2026-04-10'),
        ultima_prioridade: 7,
      },
    ];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(rows);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna array vazio quando sem recorrências', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toEqual([]);
  });
});
