import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

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
    FilterPipelines,
    GetPipeline,
    CreateYoloFeedback,
    AvaliarCondicoesVoo,
    JwtService,
    PrismaService,
  ],
  controllers: [DroneController],
  imports: [DatabaseModule],
})
export class DroneModule {}
