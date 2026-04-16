import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PluvioController } from './pluvio.controller';
import { BulkInsertItems } from './use-cases/bulk-insert-items';
import { BulkInsertRisco } from './use-cases/bulk-insert-risco';
import { CreateRun } from './use-cases/create-run';
import { DeleteItem } from './use-cases/delete-item';
import { DeleteRisco } from './use-cases/delete-risco';
import { DeleteRun } from './use-cases/delete-run';
import { FilterItems } from './use-cases/filter-items';
import { FilterRisco } from './use-cases/filter-risco';
import { FilterRuns } from './use-cases/filter-runs';
import { PluvioScheduler } from './pluvio.scheduler';
import { PluvioSchedulerService } from './pluvio-scheduler.service';
import { GerarSlasRun } from './use-cases/gerar-slas-run';
import { LatestRun } from './use-cases/latest-run';
import { UpdateRunTotal } from './use-cases/update-run-total';
import { UpsertItem } from './use-cases/upsert-item';
import { UpsertRisco } from './use-cases/upsert-risco';

@Module({
  providers: [
    FilterRuns,
    CreateRun,
    DeleteRun,
    LatestRun,
    UpdateRunTotal,
    FilterItems,
    UpsertItem,
    DeleteItem,
    BulkInsertItems,
    FilterRisco,
    UpsertRisco,
    DeleteRisco,
    BulkInsertRisco,
    GerarSlasRun,
    PluvioSchedulerService,
    PluvioScheduler,
    JwtService,
    PrismaService,
  ],
  controllers: [PluvioController],
  exports: [PluvioSchedulerService],
  imports: [DatabaseModule],
})
export class PluvioModule {}
