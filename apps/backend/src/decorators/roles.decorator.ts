import { SetMetadata } from '@nestjs/common';

export type PapelApp =
  | 'admin'
  | 'supervisor'
  | 'agente'
  | 'notificador'
  | 'analista_regional';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PapelApp[]) => SetMetadata(ROLES_KEY, roles);

export const Public = () => SetMetadata('isPublic', true);

export const SKIP_TENANT_KEY = 'skipTenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
