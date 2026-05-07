import { Injectable } from '@nestjs/common';

import { ListSecurityLogsInputType } from '../dtos/list-security-logs.input';
import { SecurityLog } from '../entities/security-log';

export interface SecurityLogPage {
  data: SecurityLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  period: { de: Date; ate: Date };
}

export interface SecurityLogStats {
  period: { de: Date; ate: Date; days: number };
  byEventType: { eventType: string; total: number }[];
  bySeverity: { severity: string; total: number }[];
  topIps: { ip: string; total: number }[];
  topPaths: { path: string; total: number }[];
}

@Injectable()
export abstract class SecurityLogReadRepository {
  abstract findMany(filters: ListSecurityLogsInputType): Promise<SecurityLogPage>;
  abstract stats(days: number): Promise<SecurityLogStats>;
}
