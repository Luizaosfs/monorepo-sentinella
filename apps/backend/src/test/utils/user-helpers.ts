import type { PapelApp } from '@/decorators/roles.decorator';
import type { AccessScope } from '@shared/security/access-scope';

export function mockRequest(overrides?: Partial<{
  user: { id: string; email: string; nome: string; clienteId: string; papeis: string[] };
  tenantId: string;
  accessScope: AccessScope;
}>) {
  const userId = overrides?.user?.id ?? 'test-user-id';
  const tenantId = overrides?.tenantId ?? 'test-cliente-id';
  return {
    user: {
      id: userId,
      email: 'test@test.com',
      nome: 'Test User',
      clienteId: 'test-cliente-id',
      papeis: ['admin'],
      ...overrides?.user,
    },
    tenantId,
    accessScope: overrides?.accessScope ?? ({
      kind: 'municipal',
      userId,
      papeis: ['supervisor'] as PapelApp[],
      isAdmin: false,
      tenantId,
      clienteIdsPermitidos: [tenantId] as [string],
      agrupamentoId: null,
    } satisfies AccessScope),
  };
}
