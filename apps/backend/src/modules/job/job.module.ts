import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BillingModule } from '@modules/billing/billing.module';
import { CnesModule } from '@modules/cnes/cnes.module';
import { CloudinaryModule } from '@modules/cloudinary/cloudinary.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { IaModule } from '@modules/ia/ia.module';
import { ImovelModule } from '@modules/imovel/imovel.module';
import { NotificacaoModule } from '@modules/notificacao/notificacao.module';
import { PluvioModule } from '@modules/pluvio/pluvio.module';
import { SlaModule } from '@modules/sla/sla.module';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AuditCleanupService } from './audit-cleanup.service';
import { JobController } from './job.controller';
import { JobScheduler } from './job.scheduler';
import { ScoreWorkerService } from './score-worker.service';
import { CancelJob } from './use-cases/cancel-job';
import { CreateJob } from './use-cases/create-job';
import { FilterJob } from './use-cases/filter-job';
import { GetJob } from './use-cases/get-job';
import { RetryJob } from './use-cases/retry-job';

@Module({
  providers: [
    FilterJob,
    GetJob,
    CreateJob,
    RetryJob,
    CancelJob,
    JobScheduler,
    ScoreWorkerService,
    AuditCleanupService,
    JwtService,
    PrismaService,
  ],
  controllers: [JobController],
  imports: [
    DatabaseModule,
    SlaModule,
    BillingModule,
    DashboardModule,
    PluvioModule,
    CloudinaryModule,
    CnesModule,
    IaModule,
    ImovelModule,
    NotificacaoModule,
  ],
})
export class JobModule {}
