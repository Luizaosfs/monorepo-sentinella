import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { BillingModule } from '../billing/billing.module';

import { DroneController } from './drone.controller';
import { AvaliarCondicoesVoo } from './use-cases/avaliar-condicoes-voo';
import { CreateDrone } from './use-cases/create-drone';
import { CreateVoo } from './use-cases/create-voo';
import { CreateYoloFeedback } from './use-cases/create-yolo-feedback';
import { DeleteDrone } from './use-cases/delete-drone';
import { DeleteVoo } from './use-cases/delete-voo';
import { FilterDrones } from './use-cases/filter-drones';
import { FilterPipelines } from './use-cases/filter-pipelines';
import { FilterVoos } from './use-cases/filter-voos';
import { GetPipeline } from './use-cases/get-pipeline';
import { SaveDrone } from './use-cases/save-drone';
import { SaveVoo } from './use-cases/save-voo';
import { AddSynonym } from './use-cases/add-synonym';
import { BulkCreateVoos } from './use-cases/bulk-create-voos';
import { DeleteSynonym } from './use-cases/delete-synonym';
import { GetDroneRiskConfig } from './use-cases/get-drone-risk-config';
import { GetYoloFeedbackByItem } from './use-cases/get-yolo-feedback-by-item';
import { ListSynonyms } from './use-cases/list-synonyms';
import { ListYoloClassConfig } from './use-cases/list-yolo-class-config';
import { ListYoloClasses } from './use-cases/list-yolo-classes';
import { UpdateDroneRiskConfig } from './use-cases/update-drone-risk-config';
import { UpdateYoloClass } from './use-cases/update-yolo-class';
import { YoloQualidadeResumo } from './use-cases/yolo-qualidade-resumo';

@Module({
  providers: [
    FilterDrones,
    CreateDrone,
    SaveDrone,
    DeleteDrone,
    FilterVoos,
    CreateVoo,
    SaveVoo,
    DeleteVoo,
    BulkCreateVoos,
    FilterPipelines,
    GetPipeline,
    CreateYoloFeedback,
    GetYoloFeedbackByItem,
    AvaliarCondicoesVoo,
    ListYoloClassConfig,
    YoloQualidadeResumo,
    GetDroneRiskConfig,
    UpdateDroneRiskConfig,
    ListYoloClasses,
    UpdateYoloClass,
    ListSynonyms,
    AddSynonym,
    DeleteSynonym,
    JwtService,
    PrismaService,
  ],
  controllers: [DroneController],
  imports: [DatabaseModule, BillingModule],
})
export class DroneModule {}
