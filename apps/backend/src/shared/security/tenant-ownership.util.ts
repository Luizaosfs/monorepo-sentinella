import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

import { AccessScope } from './access-scope';

export type TenantOwnershipErrorFactory = () => Error;

const DEFAULT_ERROR_FACTORY: TenantOwnershipErrorFactory = () =>
  new ForbiddenException('Acesso negado: recurso pertence a outro tenant');

/**
 * Valida que o recurso (identificado por clienteId) pertence ao escopo do usuário.
 *
 * - Admin com escopo total: passa.
 * - Demais papéis (incluindo analista_regional): clienteId precisa estar em scope.clienteIdsPermitidos.
 *
 * Compatibilidade preservada: usa AccessScope quando disponível (requests reais via TenantGuard).
 * Fallback para req['tenantId'] + req['user'].isPlatformAdmin quando AccessScope ausente
 * (testes unitários de use-cases que ainda mockam o modelo antigo — removido em 1B/1C).
 */
export function assertTenantOwnership(
  clienteId: string | null | undefined,
  req: Request,
  errorFactory: TenantOwnershipErrorFactory = DEFAULT_ERROR_FACTORY,
): void {
  if (!clienteId) {
    throw errorFactory();
  }

  const scope = req['accessScope'] as AccessScope | undefined;

  if (scope) {
    if (scope.clienteIdsPermitidos === null) return;
    if (!scope.clienteIdsPermitidos.includes(clienteId)) {
      throw errorFactory();
    }
    return;
  }

  // Fallback legado: suporta testes que mockam req['tenantId'] + req['user']
  const user = req['user'] as { isPlatformAdmin?: boolean } | undefined;
  if (user?.isPlatformAdmin) return;
  const tenantId = req['tenantId'] as string | undefined;
  if (!tenantId || clienteId !== tenantId) {
    throw errorFactory();
  }
}
