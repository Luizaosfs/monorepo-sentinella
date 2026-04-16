import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { IaController } from './ia.controller';
import { IaService } from './ia.service';

@Module({
  providers: [IaService, JwtService, PrismaService],
  exports: [IaService],
  controllers: [IaController],
  imports: [DatabaseModule],
})
export class IaModule {}
