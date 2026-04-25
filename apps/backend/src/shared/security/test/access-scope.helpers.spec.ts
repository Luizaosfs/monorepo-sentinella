import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

import { AccessScope, MunicipalScope, PlatformScope, RegionalScope } from '../access-scope';
import {
  getAccessScope,
  getClienteIdsPermitidos,
  requireClienteIdsPermitidos,
  requireClientePermitido,
  requireTenantId,
} from '../access-scope.helpers';

function makeReq(scope?: AccessScope): Request {
  const req: any = {};
  if (scope !== undefined) req['accessScope'] = scope;
  return req as Request;
}

const adminTotal: PlatformScope = {
  kind: 'platform',
  userId: 'u1',
  papeis: ['admin'],
  isAdmin: true,
  tenantId: null,
  clienteIdsPermitidos: null,
  agrupamentoId: null,
};

const adminFiltered: PlatformScope = {
  kind: 'platform',
  userId: 'u1',
  papeis: ['admin'],
  isAdmin: true,
  tenantId: 'c1',
  clienteIdsPermitidos: ['c1'],
  agrupamentoId: null,
};

const municipal: MunicipalScope = {
  kind: 'municipal',
  userId: 'u2',
  papeis: ['supervisor'],
  isAdmin: false,
  tenantId: 'c2',
  clienteIdsPermitidos: ['c2'],
  agrupamentoId: null,
};

const regional: RegionalScope = {
  kind: 'regional',
  userId: 'u3',
  papeis: ['analista_regional'],
  isAdmin: false,
  tenantId: null,
  clienteIdsPermitidos: ['c3', 'c4'],
  agrupamentoId: 'ag1',
};

describe('getAccessScope', () => {
  it('retorna scope quando populado', () => {
    expect(getAccessScope(makeReq(adminTotal))).toBe(adminTotal);
  });

  it('lança ForbiddenException quando ausente', () => {
    expect(() => getAccessScope(makeReq())).toThrow(ForbiddenException);
  });
});

describe('getClienteIdsPermitidos', () => {
  it('retorna null para admin sem ?clienteId', () => {
    expect(getClienteIdsPermitidos(adminTotal)).toBeNull();
  });

  it('retorna lista para admin com ?clienteId', () => {
    expect(getClienteIdsPermitidos(adminFiltered)).toEqual(['c1']);
  });

  it('retorna lista para municipal', () => {
    expect(getClienteIdsPermitidos(municipal)).toEqual(['c2']);
  });

  it('retorna lista para regional', () => {
    expect(getClienteIdsPermitidos(regional)).toEqual(['c3', 'c4']);
  });
});

describe('requireClienteIdsPermitidos', () => {
  it('lança quando admin tem escopo total (null)', () => {
    expect(() => requireClienteIdsPermitidos(adminTotal)).toThrow(ForbiddenException);
  });

  it('retorna lista quando há escopo definido', () => {
    expect(requireClienteIdsPermitidos(regional)).toEqual(['c3', 'c4']);
  });
});

describe('requireTenantId', () => {
  it('retorna tenantId para municipal', () => {
    expect(requireTenantId(municipal)).toBe('c2');
  });

  it('lança para platform sem tenantId', () => {
    expect(() => requireTenantId(adminTotal)).toThrow(ForbiddenException);
  });

  it('lança para regional', () => {
    expect(() => requireTenantId(regional)).toThrow(ForbiddenException);
  });
});

describe('requireClientePermitido', () => {
  it('passa para admin com escopo total', () => {
    expect(() => requireClientePermitido(adminTotal, 'qualquer-id')).not.toThrow();
  });

  it('passa quando clienteId está na lista', () => {
    expect(() => requireClientePermitido(regional, 'c3')).not.toThrow();
  });

  it('lança quando clienteId está fora da lista', () => {
    expect(() => requireClientePermitido(regional, 'outro')).toThrow(ForbiddenException);
  });

  it('passa para municipal com o próprio clienteId', () => {
    expect(() => requireClientePermitido(municipal, 'c2')).not.toThrow();
  });

  it('lança para municipal com clienteId de outro tenant', () => {
    expect(() => requireClientePermitido(municipal, 'outro')).toThrow(ForbiddenException);
  });
});
