import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

import { AccessScope, MunicipalScope, PlatformScope, RegionalScope } from '../access-scope';
import { assertTenantOwnership } from '../tenant-ownership.util';

function makeReq(scope: AccessScope): Request {
  return { accessScope: scope } as any;
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

const supervisor: MunicipalScope = {
  kind: 'municipal',
  userId: 'u2',
  papeis: ['supervisor'],
  isAdmin: false,
  tenantId: 'c2',
  clienteIdsPermitidos: ['c2'],
  agrupamentoId: null,
};

const analista: RegionalScope = {
  kind: 'regional',
  userId: 'u3',
  papeis: ['analista_regional'],
  isAdmin: false,
  tenantId: null,
  clienteIdsPermitidos: ['c3', 'c4'],
  agrupamentoId: 'ag1',
};

describe('assertTenantOwnership', () => {
  it('admin com escopo total passa para qualquer clienteId', () => {
    expect(() =>
      assertTenantOwnership('qualquer-id', makeReq(adminTotal)),
    ).not.toThrow();
  });

  it('admin com ?clienteId match passa', () => {
    expect(() =>
      assertTenantOwnership('c1', makeReq(adminFiltered)),
    ).not.toThrow();
  });

  it('admin com ?clienteId diferente lança', () => {
    expect(() =>
      assertTenantOwnership('outro', makeReq(adminFiltered)),
    ).toThrow(ForbiddenException);
  });

  it('supervisor com recurso do próprio cliente passa', () => {
    expect(() =>
      assertTenantOwnership('c2', makeReq(supervisor)),
    ).not.toThrow();
  });

  it('supervisor com recurso de outro cliente lança', () => {
    expect(() =>
      assertTenantOwnership('outro', makeReq(supervisor)),
    ).toThrow(ForbiddenException);
  });

  it('analista regional com recurso no agrupamento passa', () => {
    expect(() =>
      assertTenantOwnership('c3', makeReq(analista)),
    ).not.toThrow();
  });

  it('analista regional com recurso fora do agrupamento lança', () => {
    expect(() =>
      assertTenantOwnership('fora', makeReq(analista)),
    ).toThrow(ForbiddenException);
  });

  it('clienteId null lança', () => {
    expect(() =>
      assertTenantOwnership(null, makeReq(adminTotal)),
    ).toThrow(ForbiddenException);
  });
});
