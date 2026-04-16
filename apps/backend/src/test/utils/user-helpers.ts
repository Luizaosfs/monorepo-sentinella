export function mockRequest(overrides?: Partial<{
  user: { id: string; email: string; nome: string; clienteId: string; papeis: string[] };
  tenantId: string;
}>) {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@test.com',
      nome: 'Test User',
      clienteId: 'test-cliente-id',
      papeis: ['admin'],
      ...overrides?.user,
    },
    tenantId: overrides?.tenantId ?? 'test-cliente-id',
  };
}
