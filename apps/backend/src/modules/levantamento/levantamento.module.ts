import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { BillingModule } from '../billing/billing.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { FocoRiscoModule } from '../foco-risco/foco-risco.module';
import { LevantamentoController } from './levantamento.controller';
import { AddItemEvidencia } from './use-cases/add-item-evidencia';
import { CreateLevantamento } from './use-cases/create-levantamento';
import { CreateLevantamentoItem } from './use-cases/create-levantamento-item';
import { CriarItemManual } from './use-cases/criar-item-manual';
import { DeleteItem } from './use-cases/delete-item';
import { DeleteLevantamento } from './use-cases/delete-levantamento';
import { FilterLevantamento } from './use-cases/filter-levantamento';
import { GetItem } from './use-cases/get-item';
import { ListHistoricoPorCliente } from './use-cases/list-historico-por-cliente';
import { ListHistoricoPorLocalizacao } from './use-cases/list-historico-por-localizacao';
import { GetLevantamento } from './use-cases/get-levantamento';
import { ListItensMapa } from './use-cases/list-itens-mapa';
import { ListItensPorAgente } from './use-cases/list-itens-por-agente';
import { PaginationLevantamento } from './use-cases/pagination-levantamento';
import { RegistrarCheckin } from './use-cases/registrar-checkin';
import { SaveLevantamento } from './use-cases/save-levantamento';
import { UpdateItem } from './use-cases/update-item';
import { FullMapData } from './use-cases/full-map-data';
import { ItemStatusesByCliente } from './use-cases/item-statuses-by-cliente';

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
    ListItensMapa,
    ListItensPorAgente,
    PaginationLevantamento,
    RegistrarCheckin,
    SaveLevantamento,
    UpdateItem,
    ListHistoricoPorLocalizacao,
    ListHistoricoPorCliente,
    FullMapData,
    ItemStatusesByCliente,
    JwtService,
    PrismaService,
  ],
  controllers: [LevantamentoController],
  imports: [DatabaseModule, FocoRiscoModule, BillingModule, CloudinaryModule],
})
export class LevantamentoModule {}
