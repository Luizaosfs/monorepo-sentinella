import {
  AccessScope,
  MunicipalScope,
  PlatformScope,
  RegionalScope,
} from '../access-scope';

describe('AccessScope — discriminated union', () => {
  it('narrowing por kind funciona para platform', () => {
    const scope: AccessScope = {
      kind: 'platform',
      userId: 'u1',
      papeis: ['admin'],
      isAdmin: true,
      tenantId: null,
      clienteIdsPermitidos: null,
      agrupamentoId: null,
    };

    expect(scope.kind).toBe('platform');
    if (scope.kind === 'platform') {
      // TypeScript narrowing: tenantId é string | null
      const t: string | null = scope.tenantId;
      expect(t).toBeNull();
    }
  });

  it('PlatformScope aceita tenantId nullable', () => {
    const withId: PlatformScope = {
      kind: 'platform',
      userId: 'u1',
      papeis: ['admin'],
      isAdmin: true,
      tenantId: 'cliente-uuid',
      clienteIdsPermitidos: ['cliente-uuid'],
      agrupamentoId: null,
    };
    const withNull: PlatformScope = {
      kind: 'platform',
      userId: 'u1',
      papeis: ['admin'],
      isAdmin: true,
      tenantId: null,
      clienteIdsPermitidos: null,
      agrupamentoId: null,
    };

    expect(withId.tenantId).toBe('cliente-uuid');
    expect(withNull.tenantId).toBeNull();
  });

  it('MunicipalScope e RegionalScope têm tenantId correto', () => {
    const municipal: MunicipalScope = {
      kind: 'municipal',
      userId: 'u2',
      papeis: ['supervisor'],
      isAdmin: false,
      tenantId: 'muni-uuid',
      clienteIdsPermitidos: ['muni-uuid'],
      agrupamentoId: null,
    };
    const regional: RegionalScope = {
      kind: 'regional',
      userId: 'u3',
      papeis: ['analista_regional'],
      isAdmin: false,
      tenantId: null,
      clienteIdsPermitidos: ['c1', 'c2'],
      agrupamentoId: 'agrup-uuid',
    };

    // MunicipalScope.tenantId deve ser string (não-nulo)
    const mTenant: string = municipal.tenantId;
    expect(mTenant).toBe('muni-uuid');

    // RegionalScope.tenantId deve ser null
    expect(regional.tenantId).toBeNull();
    expect(regional.agrupamentoId).toBe('agrup-uuid');
  });
});
