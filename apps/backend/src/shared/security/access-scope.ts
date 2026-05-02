import { PapelApp } from '@/decorators/roles.decorator';

/**
 * AccessScope é a fonte canônica do escopo de acesso do usuário autenticado
 * para uma request. Substitui o uso ingênuo de `req['tenantId'] as string`.
 *
 * Construído pelo TenantGuard a partir de `req.user`. Anexado em `req.accessScope`.
 *
 * Variantes (mutuamente exclusivas):
 *
 *   PLATFORM:
 *     - admin (isPlatformAdmin = true)
 *     - tenantId pode ser null (admin sem ?clienteId) ou string (admin com ?clienteId)
 *     - clienteIdsPermitidos: null = escopo total | [tenantId] = escopo ao cliente escolhido
 *
 *   MUNICIPAL:
 *     - supervisor / agente / notificador
 *     - tenantId = user.clienteId (não-nulo, garantido pelo guard)
 *     - clienteIdsPermitidos = [tenantId] (sempre 1 elemento)
 *
 *   REGIONAL:
 *     - analista_regional
 *     - tenantId = ?clienteId (se fornecido e validado contra o agrupamento) | null (escopo total do agrupamento)
 *     - agrupamentoId = user.agrupamentoId (não-nulo, garantido pelo guard)
 *     - clienteIdsPermitidos = lista de clientes do agrupamento (não-vazia, garantida pelo guard)
 */
export type AccessScope = PlatformScope | MunicipalScope | RegionalScope;

export type PlatformScope = {
  kind: 'platform';
  userId: string;
  papeis: PapelApp[];
  isAdmin: true;
  tenantId: string | null;
  clienteIdsPermitidos: string[] | null; // null = escopo total
  agrupamentoId: null;
};

export type MunicipalScope = {
  kind: 'municipal';
  userId: string;
  papeis: PapelApp[];
  isAdmin: false;
  tenantId: string;
  clienteIdsPermitidos: [string]; // sempre 1 elemento
  agrupamentoId: null;
};

export type RegionalScope = {
  kind: 'regional';
  userId: string;
  papeis: PapelApp[];
  isAdmin: false;
  tenantId: string | null; // null = todos do agrupamento; string = município selecionado via ?clienteId
  clienteIdsPermitidos: string[]; // 1+ elementos, garantido pelo guard
  agrupamentoId: string;
};
