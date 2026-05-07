import { http } from '@sentinella/api-client';

export interface SecurityLogEntry {
  id: string;
  eventType: string;
  severity: string;
  userId: string | null;
  clienteId: string | null;
  role: string | null;
  ip: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SecurityLogListResult {
  data: SecurityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  period: { de: string; ate: string };
}

export interface SecurityLogStats {
  period: { de: string; ate: string; days: number };
  byEventType: { eventType: string; total: number }[];
  bySeverity: { severity: string; total: number }[];
  topIps: { ip: string; total: number }[];
  topPaths: { path: string; total: number }[];
}

export const securityLogs = {
  list: (params: {
    page?: number;
    pageSize?: number;
    eventType?: string;
    severity?: string;
    ip?: string;
    userId?: string;
    clienteId?: string;
    de?: string;
    ate?: string;
  }): Promise<SecurityLogListResult> =>
    http.get('/security-logs', { params }),

  stats: (days?: number): Promise<SecurityLogStats> =>
    http.get('/security-logs/stats', { params: { days } }),
};
