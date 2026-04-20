import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

export type TenantOwnershipErrorFactory = () => Error;

const DEFAULT_ERROR_FACTORY: TenantOwnershipErrorFactory = () =>
  new ForbiddenException('Acesso negado: recurso pertence a outro tenant');

export function assertTenantOwnership(
  clienteId: string | null | undefined,
  req: Request,
  errorFactory: TenantOwnershipErrorFactory = DEFAULT_ERROR_FACTORY,
): void {
  const user = req['user'] as AuthenticatedUser | undefined;
  if (user?.isPlatformAdmin) return;
  const tenantId = req['tenantId'] as string | undefined;
  if (!tenantId || clienteId !== tenantId) {
    throw errorFactory();
  }
}
