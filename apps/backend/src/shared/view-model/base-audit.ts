/**
 * Campos de auditoria da BaseEntity na resposta HTTP (padrão mf-api-finance: expor soft-delete e autoria).
 */
export function baseAuditToHttp(entity: {
  deletedAt?: Date;
  createdBy?: string;
  deletedBy?: string;
}) {
  return {
    deletedAt: entity.deletedAt ?? undefined,
    createdBy: entity.createdBy ?? undefined,
    deletedBy: entity.deletedBy ?? undefined,
  };
}
