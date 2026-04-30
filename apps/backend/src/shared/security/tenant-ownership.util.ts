import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

import { AccessScope } from './access-scope';

export type TenantOwnershipErrorFactory = () => Error;

const DEFAULT_ERROR_FACTORY: TenantOwnershipErrorFactory = () =>
  new ForbiddenException('Acesso negado: recurso pertence a outro tenant');

/**
 * Valida que o recurso (identificado por clienteId) pertence ao escopo do usuário.
 *
 * - Admin com escopo total (clienteIdsPermitidos === null): passa.
 * - Demais papéis (incluindo analista_regional): clienteId precisa estar em scope.clienteIdsPermitidos.
 * - Scope ausente (sem TenantGuard): nega acesso.
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

  if (!scope) {
    throw errorFactory();
  }

  if (scope.clienteIdsPermitidos === null) return;
  if (!scope.clienteIdsPermitidos.includes(clienteId)) {
    throw errorFactory();
  }
}
