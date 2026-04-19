import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImportLogController } from './import-log.controller';
import { CreateImport } from './use-cases/create-import';
import { FinalizarImport } from './use-cases/finalizar-import';
import { FilterImports } from './use-cases/filter-imports';
import { GetImport } from './use-cases/get-import';

@Module({
  providers: [CreateImport, FilterImports, GetImport, FinalizarImport, JwtService, PrismaService],
  controllers: [ImportLogController],
  imports: [DatabaseModule],
})
export class ImportLogModule {}
