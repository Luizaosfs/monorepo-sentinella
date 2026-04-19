import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { OperacaoController } from './operacao.controller';
import { AddEvidencia } from './use-cases/add-evidencia';
import { ListExistingItemIds } from './use-cases/list-existing-item-ids';
import { ResolverStatusItem } from './use-cases/resolver-status-item';
import { BulkInsertOperacoes } from './use-cases/bulk-insert-operacoes';
import { ConcluirParaItemOperacao } from './use-cases/concluir-para-item-operacao';
import { CreateOperacao } from './use-cases/create-operacao';
import { CriarParaItem } from './use-cases/criar-para-item';
import { DeleteOperacao } from './use-cases/delete-operacao';
import { EnsureAndConcluir } from './use-cases/ensure-and-concluir';
import { EnsureEmAndamento } from './use-cases/ensure-em-andamento';
import { EnviarEquipe } from './use-cases/enviar-equipe';
import { FilterOperacao } from './use-cases/filter-operacao';
import { GetOperacao } from './use-cases/get-operacao';
import { ListarComVinculos } from './use-cases/listar-com-vinculos';
import { PaginationOperacao } from './use-cases/pagination-operacao';
import { ResolverOperacao } from './use-cases/resolver-operacao';
import { SaveOperacao } from './use-cases/save-operacao';
import { StatsOperacao } from './use-cases/stats-operacao';
import { UpsertOperacao } from './use-cases/upsert-operacao';

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
    UpsertOperacao,
    BulkInsertOperacoes,
    ConcluirParaItemOperacao,
    ListarComVinculos,
    EnsureEmAndamento,
    EnsureAndConcluir,
    ResolverStatusItem,
    ListExistingItemIds,
    JwtService,
    PrismaService,
  ],
  controllers: [OperacaoController],
  imports: [DatabaseModule],
})
export class OperacaoModule {}
