import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { LevantamentoController } from './levantamento.controller';
import { AddItemEvidencia } from './use-cases/add-item-evidencia';
import { CreateLevantamento } from './use-cases/create-levantamento';
import { CreateLevantamentoItem } from './use-cases/create-levantamento-item';
import { CriarItemManual } from './use-cases/criar-item-manual';
import { DeleteItem } from './use-cases/delete-item';
import { DeleteLevantamento } from './use-cases/delete-levantamento';
import { FilterLevantamento } from './use-cases/filter-levantamento';
import { GetItem } from './use-cases/get-item';
import { GetLevantamento } from './use-cases/get-levantamento';
import { PaginationLevantamento } from './use-cases/pagination-levantamento';
import { SaveLevantamento } from './use-cases/save-levantamento';
import { UpdateItem } from './use-cases/update-item';

@Module({
  providers: [
    AddItemEvidencia,
    CreateLevantamento,
    CreateLevantamentoItem,
    CriarItemManual,
    DeleteItem,
    DeleteLevantamento,
    FilterLevantamento,
    GetItem,
    GetLevantamento,
    PaginationLevantamento,
    SaveLevantamento,
    UpdateItem,
    JwtService,
    PrismaService,
  ],
  controllers: [LevantamentoController],
  imports: [DatabaseModule],
})
export class LevantamentoModule {}
