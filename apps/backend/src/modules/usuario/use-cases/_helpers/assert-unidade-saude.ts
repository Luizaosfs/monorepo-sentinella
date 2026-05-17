import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { UsuarioException } from '../../errors/usuario.exception';

/**
 * Garante que a unidade de saúde existe, está ativa e pertence ao mesmo
 * cliente do usuário. Defesa cross-tenant — o vínculo notificador↔unidade
 * nunca pode apontar para unidade de outro município.
 */
export async function assertUnidadeSaudePertenceCliente(
  prisma: PrismaService,
  unidadeSaudeId: string,
  clienteId: string | undefined,
): Promise<void> {
  if (!clienteId) throw UsuarioException.unidadeSaudeInvalida();

  const unidade = await prisma.client.unidades_saude.findFirst({
    where: {
      id: unidadeSaudeId,
      cliente_id: clienteId,
      ativo: true,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!unidade) throw UsuarioException.unidadeSaudeInvalida();
}
