/**
 * Valores de `job_queue.status` permitidos por `job_queue_status_check` no PostgreSQL.
 * Não usar sinônimos (ex.: em_andamento, erro) — violam o CHECK.
 */
export const JOB_QUEUE_STATUS = {
  pendente: 'pendente',
  emExecucao: 'em_execucao',
  concluido: 'concluido',
  falhou: 'falhou',
  cancelado: 'cancelado',
} as const;

export type JobQueueStatus =
  (typeof JOB_QUEUE_STATUS)[keyof typeof JOB_QUEUE_STATUS];
