import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AuthenticatedUser } from '../auth.guard';
import { TenantGuard } from '../tenant.guard';

const mockFindMany = jest.fn();

const mockPrisma = {
  client: {
    agrupamento_cliente: {
      findMany: mockFindMany,
    },
  },
};

function makeContext(opts: {
  isPublic?: boolean;
  skipTenant?: boolean;
  user?: AuthenticatedUser | undefined;
  query?: Record<string, string>;
}): ExecutionContext {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === 'isPublic') return opts.isPublic ?? false;
      if (key === 'skipTenant') return opts.skipTenant ?? false;
      return undefined;
    },
  };

  const request: any = {
    user: opts.user,
    query: opts.query ?? {},
  };

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    _request: request,
    _reflector: reflector,
  } as any;
}

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function setupReflector(isPublic: boolean, skipTenant: boolean) {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === 'isPublic') return isPublic;
      if (key === 'skipTenant') return skipTenant;
      return undefined;
    });
  }

  function makeCtx(user?: AuthenticatedUser, query: Record<string, string> = {}) {
    const request: any = { user, query };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
      _request: request,
    } as unknown as ExecutionContext;
  }

  it('@Public route → return true sem buildScope', async () => {
    setupReflector(true, false);
    const ctx = makeCtx(undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('@SkipTenant route → return true sem buildScope', async () => {
    setupReflector(false, true);
    const ctx = makeCtx(undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('sem user no request → return false', async () => {
    setupReflector(false, false);
    const ctx = makeCtx(undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  it('admin sem ?clienteId → PlatformScope com tenantId=null, clienteIdsPermitidos=null', async () => {
    setupReflector(false, false);
    const user: AuthenticatedUser = {
      id: 'u1',
      authId: 'a1',
      email: 'admin@test.com',
      nome: 'Admin',
      clienteId: null,
      agrupamentoId: null,
      papeis: ['admin'],
      isPlatformAdmin: true,
    };
    const ctx = makeCtx(user, {});
    const req = (ctx as any)._request;

    await guard.canActivate(ctx);

    expect(req.accessScope).toMatchObject({
      kind: 'platform',
      isAdmin: true,
      tenantId: null,
      clienteIdsPermitidos: null,
      agrupamentoId: null,
    });
    expect(req.tenantId).toBeNull();
  });

  it('admin com ?clienteId=X → PlatformScope com tenantId=X, clienteIdsPermitidos=[X]', async () => {
    setupReflector(false, false);
    const user: AuthenticatedUser = {
      id: 'u1',
      authId: 'a1',
      email: 'admin@test.com',
      nome: 'Admin',
      clienteId: null,
      agrupamentoId: null,
      papeis: ['admin'],
      isPlatformAdmin: true,
    };
    const ctx = makeCtx(user, { clienteId: 'cliente-x' });
    const req = (ctx as any)._request;

    await guard.canActivate(ctx);

    expect(req.accessScope).toMatchObject({
      kind: 'platform',
      tenantId: 'cliente-x',
      clienteIdsPermitidos: ['cliente-x'],
    });
    expect(req.tenantId).toBe('cliente-x');
  });

  it('supervisor com clienteId → MunicipalScope correto', async () => {
    setupReflector(false, false);
    const user: AuthenticatedUser = {
      id: 'u2',
      authId: 'a2',
      email: 'sup@test.com',
      nome: 'Supervisor',
      clienteId: 'muni-uuid',
      agrupamentoId: null,
      papeis: ['supervisor'],
      isPlatformAdmin: false,
    };
    const ctx = makeCtx(user);
    const req = (ctx as any)._request;

    await guard.canActivate(ctx);

    expect(req.accessScope).toMatchObject({
      kind: 'municipal',
      tenantId: 'muni-uuid',
      clienteIdsPermitidos: ['muni-uuid'],
      agrupamentoId: null,
    });
    expect(req.tenantId).toBe('muni-uuid');
  });

  it('supervisor sem clienteId → ForbiddenException', async () => {
    setupReflector(false, false);
    const user: AuthenticatedUser = {
      id: 'u2',
      authId: 'a2',
      email: 'sup@test.com',
      nome: 'Supervisor',
      clienteId: null,
      agrupamentoId: null,
      papeis: ['supervisor'],
      isPlatformAdmin: false,
    };
    const ctx = makeCtx(user);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('analista_regional sem agrupamentoId → ForbiddenException', async () => {
    setupReflector(false, false);
    const user: AuthenticatedUser = {
      id: 'u3',
      authId: 'a3',
      email: 'ar@test.com',
      nome: 'Analista',
      clienteId: null,
      agrupamentoId: null,
      papeis: ['analista_regional'],
      isPlatformAdmin: false,
    };
    const ctx = makeCtx(user);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('analista_regional com agrupamento vazio → ForbiddenException', async () => {
    setupReflector(false, false);
    mockFindMany.mockResolvedValue([]);
    const user: AuthenticatedUser = {
      id: 'u3',
      authId: 'a3',
      email: 'ar@test.com',
      nome: 'Analista',
      clienteId: null,
      agrupamentoId: 'ag-vazio',
      papeis: ['analista_regional'],
      isPlatformAdmin: false,
    };
    const ctx = makeCtx(user);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('analista_regional com agrupamento válido → RegionalScope correto', async () => {
    setupReflector(false, false);
    mockFindMany.mockResolvedValue([
      { cliente_id: 'c1' },
      { cliente_id: 'c2' },
    ]);
    const user: AuthenticatedUser = {
      id: 'u3',
      authId: 'a3',
      email: 'ar@test.com',
      nome: 'Analista',
      clienteId: null,
      agrupamentoId: 'ag-uuid',
      papeis: ['analista_regional'],
      isPlatformAdmin: false,
    };
    const ctx = makeCtx(user);
    const req = (ctx as any)._request;

    await guard.canActivate(ctx);

    expect(req.accessScope).toMatchObject({
      kind: 'regional',
      tenantId: null,
      clienteIdsPermitidos: ['c1', 'c2'],
      agrupamentoId: 'ag-uuid',
    });
    expect(req.tenantId).toBeNull();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { agrupamento_id: 'ag-uuid' },
      select: { cliente_id: true },
    });
  });
});
