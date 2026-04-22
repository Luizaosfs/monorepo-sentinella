import { PrismaClient } from '@prisma/client';

/**
 * Seeds fixos para suíte e2e. UUIDs constantes para uso em assertions.
 *
 * Isolamento: tudo escopado a `E2E_CLIENTE_ID`. Não tocar dados de outros
 * clientes. Idempotente — pode rodar N vezes sem duplicar.
 */
export const E2E_CLIENTE_ID = '00000000-e2e0-4000-8000-000000000001';
export const E2E_CLIENTE_SLUG = 'e2e';

export const AGENTE_USUARIO_ID = '00000000-e2e0-4000-8000-0000000000a1';
export const AGENTE_AUTH_ID = '00000000-e2e0-4000-8000-0000000000a2';

export const SUPERVISOR_USUARIO_ID = '00000000-e2e0-4000-8000-0000000000b1';
export const SUPERVISOR_AUTH_ID = '00000000-e2e0-4000-8000-0000000000b2';

export const INATIVO_USUARIO_ID = '00000000-e2e0-4000-8000-0000000000c1';
export const INATIVO_AUTH_ID = '00000000-e2e0-4000-8000-0000000000c2';

// Admin de plataforma — sem cliente_id (papel canônico, ver CLAUDE.md).
export const ADMIN_USUARIO_ID = '00000000-e2e0-4000-8000-0000000000e1';
export const ADMIN_AUTH_ID = '00000000-e2e0-4000-8000-0000000000e2';

export async function seedE2E(prisma: PrismaClient): Promise<void> {
  await prisma.clientes.upsert({
    where: { id: E2E_CLIENTE_ID },
    create: {
      id: E2E_CLIENTE_ID,
      slug: E2E_CLIENTE_SLUG,
      nome: 'E2E Município',
      ativo: true,
    },
    update: { ativo: true, slug: E2E_CLIENTE_SLUG, nome: 'E2E Município' },
  });

  await prisma.planos.upsert({
    where: { id: '00000000-e2e0-4000-8000-0000000000d0' },
    create: {
      id: '00000000-e2e0-4000-8000-0000000000d0',
      nome: 'basico',
      ativo: true,
      ordem: 0,
    },
    update: { nome: 'basico', ativo: true },
  });

  const usuariosFixos = [
    {
      id: AGENTE_USUARIO_ID,
      auth_id: AGENTE_AUTH_ID,
      nome: 'E2E Agente',
      email: 'e2e-agente@sentinella.test',
      papel: 'agente' as const,
      ativo: true,
      clienteId: E2E_CLIENTE_ID as string | null,
    },
    {
      id: SUPERVISOR_USUARIO_ID,
      auth_id: SUPERVISOR_AUTH_ID,
      nome: 'E2E Supervisor',
      email: 'e2e-supervisor@sentinella.test',
      papel: 'supervisor' as const,
      ativo: true,
      clienteId: E2E_CLIENTE_ID as string | null,
    },
    {
      id: INATIVO_USUARIO_ID,
      auth_id: INATIVO_AUTH_ID,
      nome: 'E2E Inativo',
      email: 'e2e-inativo@sentinella.test',
      papel: 'agente' as const,
      ativo: false,
      clienteId: E2E_CLIENTE_ID as string | null,
    },
    {
      id: ADMIN_USUARIO_ID,
      auth_id: ADMIN_AUTH_ID,
      nome: 'E2E Admin',
      email: 'e2e-admin@sentinella.test',
      papel: 'admin' as const,
      ativo: true,
      clienteId: null,
    },
  ];

  for (const u of usuariosFixos) {
    await prisma.usuarios.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        auth_id: u.auth_id,
        nome: u.nome,
        email: u.email,
        cliente_id: u.clienteId,
        ativo: u.ativo,
      },
      update: {
        auth_id: u.auth_id,
        nome: u.nome,
        email: u.email,
        cliente_id: u.clienteId,
        ativo: u.ativo,
      },
    });

    // papeis_usuarios.usuario_id referencia usuarios.auth_id (não .id).
    const jaTemPapel = await prisma.papeis_usuarios.findFirst({
      where: { usuario_id: u.auth_id, papel: u.papel },
    });
    if (!jaTemPapel) {
      await prisma.papeis_usuarios.create({
        data: { usuario_id: u.auth_id, papel: u.papel },
      });
    }
  }
}
