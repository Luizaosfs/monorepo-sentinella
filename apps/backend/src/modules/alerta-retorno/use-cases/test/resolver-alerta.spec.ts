import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { mockRequest } from '@test/utils/user-helpers';

import { ResolverAlerta } from '../resolver-alerta';

describe('ResolverAlerta', () => {
  const mockFindFirst = jest.fn();
  const mockUpdate = jest.fn();

  const prismaValue = {
    client: {
      alerta_retorno_imovel: {
        findFirst: mockFindFirst,
        update: mockUpdate,
      },
    },
  };

  async function buildWithRequest(req: ReturnType<typeof mockRequest>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolverAlerta,
        { provide: PrismaService, useValue: prismaValue },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();
    return module.get<ResolverAlerta>(ResolverAlerta);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('resolve alerta do próprio agente e retorna { resolved: true }', async () => {
    const useCase = await buildWithRequest(
      mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
    );
    mockFindFirst.mockResolvedValue({
      id: 'alerta-id',
      cliente_id: 'cliente-uuid',
      agente_id: 'agente-uuid',
    });

    const result = await useCase.execute('alerta-id', 'cliente-uuid');

    expect(result).toEqual({ resolved: true });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alerta-id' },
        data: expect.objectContaining({ resolvido: true }),
      }),
    );
  });

  it('lança NotFoundException quando alerta não existe ou é de outro tenant', async () => {
    const useCase = await buildWithRequest(mockRequest());
    mockFindFirst.mockResolvedValue(null);

    await expect(useCase.execute('alerta-id', 'cliente-uuid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('agente bloqueado se alerta.agente_id !== user.id (IDOR)', async () => {
    const useCase = await buildWithRequest(
      mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
    );
    mockFindFirst.mockResolvedValue({
      id: 'alerta-id',
      cliente_id: 'cliente-uuid',
      agente_id: 'outro-agente-uuid',
    });

    await expect(useCase.execute('alerta-id', 'cliente-uuid')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('agente pode resolver alerta sem agente_id definido', async () => {
    const useCase = await buildWithRequest(
      mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
    );
    mockFindFirst.mockResolvedValue({
      id: 'alerta-id',
      cliente_id: 'cliente-uuid',
      agente_id: null,
    });

    const result = await useCase.execute('alerta-id', 'cliente-uuid');

    expect(result).toEqual({ resolved: true });
  });

  it('supervisor pode resolver alerta de qualquer agente', async () => {
    const useCase = await buildWithRequest(
      mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
    );
    mockFindFirst.mockResolvedValue({
      id: 'alerta-id',
      cliente_id: 'cliente-uuid',
      agente_id: 'algum-agente',
    });

    const result = await useCase.execute('alerta-id', 'cliente-uuid');

    expect(result).toEqual({ resolved: true });
  });

  it('admin (isPlatformAdmin) pode resolver alerta de qualquer agente', async () => {
    const useCase = await buildWithRequest(
      mockRequest({ user: { id: 'admin-uuid', email: 'admin@test.com', nome: 'Admin', clienteId: 'test-cliente-id', papeis: ['admin'], isPlatformAdmin: true } as any }),
    );
    mockFindFirst.mockResolvedValue({
      id: 'alerta-id',
      cliente_id: 'cliente-uuid',
      agente_id: 'algum-agente',
    });

    const result = await useCase.execute('alerta-id', 'cliente-uuid');

    expect(result).toEqual({ resolved: true });
  });
});
