import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ResolverAlerta } from '../resolver-alerta';

describe('ResolverAlerta', () => {
  let useCase: ResolverAlerta;
  const mockUpdateMany = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolverAlerta,
        {
          provide: PrismaService,
          useValue: {
            client: {
              alerta_retorno_imovel: { updateMany: mockUpdateMany },
            },
          },
        },
      ],
    }).compile();

    useCase = module.get<ResolverAlerta>(ResolverAlerta);
  });

  it('resolve alerta e retorna { resolved: true }', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await useCase.execute('alerta-id', 'cliente-uuid');

    expect(result).toEqual({ resolved: true });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alerta-id', cliente_id: 'cliente-uuid' },
      }),
    );
  });

  it('lança NotFoundException para alerta de outro cliente (IDOR)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute('alerta-id', 'outro-cliente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
