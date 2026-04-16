import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { LevantamentoController } from './levantamento.controller';
import { CreateLevantamento } from './use-cases/create-levantamento';
import { CreateLevantamentoItem } from './use-cases/create-levantamento-item';
import { CriarItemManual } from './use-cases/criar-item-manual';
import { FilterLevantamento } from './use-cases/filter-levantamento';
import { GetLevantamento } from './use-cases/get-levantamento';
import { PaginationLevantamento } from './use-cases/pagination-levantamento';
import { SaveLevantamento } from './use-cases/save-levantamento';

@Module({
  providers: [
    CreateLevantamento,
    CreateLevantamentoItem,
    CriarItemManual,
    FilterLevantamento,
    GetLevantamento,
    PaginationLevantamento,
    SaveLevantamento,
    JwtService,
    PrismaService,
  ],
  controllers: [LevantamentoController],
  imports: [DatabaseModule],
})
export class LevantamentoModule {}
