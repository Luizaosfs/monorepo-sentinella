import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingSchedulerService } from '@modules/billing/billing-scheduler.service';
import { CanalCidadaoService } from '@modules/notificacao/canal-cidadao.service';
import { CnesService } from '@modules/cnes/cnes.service';
import { CloudinaryService } from '@modules/cloudinary/cloudinary.service';
import { DashboardSchedulerService } from '@modules/dashboard/dashboard-scheduler.service';
import { HealthCheckService } from '@modules/dashboard/health-check.service';
import { IaService } from '@modules/ia/ia.service';
import { PluvioSchedulerService } from '@modules/pluvio/pluvio-scheduler.service';
import { SlaSchedulerService } from '@modules/sla/sla-scheduler.service';

import { AuditCleanupService } from './audit-cleanup.service';
import { Job } from './entities/job';
import { JOB_QUEUE_STATUS } from './job-queue.constants';
import { JobReadRepository } from './repositories/job-read.repository';
import { JobWriteRepository } from './repositories/job-write.repository';
import { ScoreWorkerService } from './score-worker.service';

@Injectable()
export class JobScheduler {
  private readonly logger = new Logger(JobScheduler.name);

  constructor(
    private readRepository: JobReadRepository,
    private writeRepository: JobWriteRepository,
    private slaScheduler: SlaSchedulerService,
    private billingScheduler: BillingSchedulerService,
    private dashboardScheduler: DashboardSchedulerService,
    private pluvioScheduler: PluvioSchedulerService,
    private cloudinaryService: CloudinaryService,
    private cnesService: CnesService,
    private iaService: IaService,
    private scoreWorker: ScoreWorkerService,
    private auditCleanup: AuditCleanupService,
    private healthCheck: HealthCheckService,
    private canalCidadao: CanalCidadaoService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue() {
    let pendentes: Job[];
    try {
      pendentes = await this.readRepository.findPendentes(10);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P1001') {
        this.logger.warn('[JobScheduler] Base indisponível (P1001); fila não consultada neste ciclo.');
        return;
      }
      throw err;
    }

    for (const job of pendentes) {
      try {
        job.status = JOB_QUEUE_STATUS.emExecucao;
        job.iniciadoEm = new Date();
        await this.writeRepository.save(job);
        this.logger.log(`[JobScheduler] Processando job ${job.id} tipo=${job.tipo}`);

        const payload = (job.payload ?? {}) as Record<string, string>;

        switch (job.tipo) {
          case 'triagem_ia':
            await this.iaService.triagemPosVoo(payload.levantamentoId, payload.clienteId);
            break;
          case 'relatorio_semanal':
            await this.dashboardScheduler.relatorioSemanal();
            break;
          case 'cnes_sync':
            await this.cnesService.sync(payload.clienteId);
            break;
          case 'limpeza_retencao':
            await this.auditCleanup.cleanupLogs();
            break;
          case 'cloudinary_cleanup':
            await this.cloudinaryService.cleanup();
            break;
          case 'health_check':
            await this.healthCheck.check();
            break;
          case 'recalcular_score_imovel':
          case 'recalcular_score_por_caso':
          case 'recalcular_score_lote':
            await this.scoreWorker.processScoreJobs();
            break;
          case 'notif_canal_cidadao':
            await this.canalCidadao.processarDenuncia(payload.focoId, payload.clienteId);
            break;
          case 'pluvio_risco_daily':
            await this.pluvioScheduler.riscoDaily();
            break;
          default:
            this.logger.warn(`[JobScheduler] Tipo de job desconhecido: ${job.tipo}`);
        }

        job.status = JOB_QUEUE_STATUS.concluido;
        job.concluidoEm = new Date();
        await this.writeRepository.save(job);
      } catch (err: any) {
        job.status = JOB_QUEUE_STATUS.falhou;
        job.erro = err?.message ?? 'Erro desconhecido';
        job.tentativas = job.tentativas + 1;
        await this.writeRepository.save(job);
        this.logger.error(`[JobScheduler] Falha no job ${job.id}: ${job.erro}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async billingSnapshot() {
    this.logger.log('[JobScheduler.billingSnapshot] Gerando snapshot de billing');
    await this.billingScheduler.snapshot();
  }

  @Cron('0 6 * * *')
  async slaMarcarVencidos() {
    this.logger.log('[JobScheduler.slaMarcarVencidos] Marcando SLAs vencidos');
    await this.slaScheduler.marcarVencidos();
  }

  @Cron('*/15 * * * *')
  async slaPushCritico() {
    this.logger.log('[JobScheduler.slaPushCritico] Verificando SLAs críticos');
    await this.slaScheduler.pushCritico();
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async relatorioSemanal() {
    this.logger.log('[JobScheduler.relatorioSemanal] Gerando relatório semanal');
    await this.dashboardScheduler.relatorioSemanal();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resumoDiario() {
    this.logger.log('[JobScheduler.resumoDiario] Gerando resumo diário');
    await this.dashboardScheduler.resumoDiario();
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cloudinaryCleanup() {
    this.logger.log('[JobScheduler.cloudinaryCleanup] Limpando imagens órfãs');
    await this.cloudinaryService.cleanup();
  }

  @Cron('0 3 * * *')
  async limpezaLogs() {
    this.logger.log('[JobScheduler.limpezaLogs] Limpando logs antigos');
    await this.auditCleanup.cleanupLogs();
  }
}
