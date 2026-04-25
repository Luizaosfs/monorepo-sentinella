import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

import {
  AccessScope,
  MunicipalScope,
  PlatformScope,
  RegionalScope,
} from './access-scope';

/**
 * Extrai o AccessScope da request. Lança se não foi populado pelo TenantGuard.
 */
export function getAccessScope(req: Request): AccessScope {
  const scope = req['accessScope'] as AccessScope | undefined;
  if (!scope) {
    throw new ForbiddenException(
      'AccessScope não populado — verifique TenantGuard ou decoradores @Public/@SkipTenant',
    );
  }
  return scope;
}

/**
 * Retorna lista de clientes permitidos ou null para escopo total (admin sem ?clienteId).
 * null → admin: SELECT sem filtro de cliente
 * [...] → demais: SELECT WHERE cliente_id = ANY($clienteIds)
 */
export function getClienteIdsPermitidos(scope: AccessScope): string[] | null {
  return scope.clienteIdsPermitidos;
}

/**
 * Retorna lista de clientes permitidos ou lança se admin tentar escopo total.
 * Use em endpoints que sempre exigem filtro por cliente.
 */
export function requireClienteIdsPermitidos(scope: AccessScope): string[] {
  const ids = scope.clienteIdsPermitidos;
  if (ids === null) {
    throw new ForbiddenException(
      'Endpoint requer escopo de cliente — admin deve passar ?clienteId',
    );
  }
  return ids;
}

/**
 * Retorna tenantId único ou lança se escopo for regional ou platform sem ?clienteId.
 * Use apenas em endpoints MUNICIPAIS que não suportam analista_regional.
 */
export function requireTenantId(scope: AccessScope): string {
  if (scope.tenantId === null) {
    throw new ForbiddenException(
      'Endpoint exige cliente único (tenantId) — não suporta escopo platform ou regional',
    );
  }
  return scope.tenantId;
}

/**
 * Valida que um clienteId específico está no escopo permitido.
 * Admin com escopo total sempre passa. Outros: clienteId precisa estar em clienteIdsPermitidos.
 */
export function requireClientePermitido(
  scope: AccessScope,
  clienteId: string,
): void {
  if (scope.clienteIdsPermitidos === null) return;
  if (!scope.clienteIdsPermitidos.includes(clienteId)) {
    throw new ForbiddenException(
      'Acesso negado: cliente fora do escopo permitido',
    );
  }
}

export function isPlatformScope(scope: AccessScope): scope is PlatformScope {
  return scope.kind === 'platform';
}

export function isMunicipalScope(scope: AccessScope): scope is MunicipalScope {
  return scope.kind === 'municipal';
}

export function isRegionalScope(scope: AccessScope): scope is RegionalScope {
  return scope.kind === 'regional';
}
