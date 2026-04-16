import { Module } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CnesScheduler } from './cnes.scheduler';
import { CnesService } from './cnes.service';

@Module({
  providers: [CnesService, CnesScheduler, PrismaService],
  exports: [CnesService],
})
export class CnesModule {}
