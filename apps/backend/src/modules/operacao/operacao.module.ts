import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { OperacaoController } from './operacao.controller';
import { AddEvidencia } from './use-cases/add-evidencia';
import { CreateOperacao } from './use-cases/create-operacao';
import { CriarParaItem } from './use-cases/criar-para-item';
import { DeleteOperacao } from './use-cases/delete-operacao';
import { EnviarEquipe } from './use-cases/enviar-equipe';
import { FilterOperacao } from './use-cases/filter-operacao';
import { GetOperacao } from './use-cases/get-operacao';
import { PaginationOperacao } from './use-cases/pagination-operacao';
import { ResolverOperacao } from './use-cases/resolver-operacao';
import { SaveOperacao } from './use-cases/save-operacao';
import { StatsOperacao } from './use-cases/stats-operacao';

@Module({
  providers: [
    FilterOperacao,
    PaginationOperacao,
    GetOperacao,
    StatsOperacao,
    CreateOperacao,
    SaveOperacao,
    CriarParaItem,
    EnviarEquipe,
    ResolverOperacao,
    AddEvidencia,
    DeleteOperacao,
    JwtService,
    PrismaService,
  ],
  controllers: [OperacaoController],
  imports: [DatabaseModule],
})
export class OperacaoModule {}
