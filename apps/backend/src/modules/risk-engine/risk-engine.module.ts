import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { RiskEngineController } from './risk-engine.controller';
import { FilterYoloClasses } from './use-cases/filter-yolo-classes';
import { FilterYoloSynonyms } from './use-cases/filter-yolo-synonyms';
import { GetDroneConfig } from './use-cases/get-drone-config';
import { GetPolicy } from './use-cases/get-policy';
import { GetPolicyFull } from './use-cases/get-policy-full';
import { SaveDroneConfig } from './use-cases/save-drone-config';
import { SavePolicy } from './use-cases/save-policy';
import { SavePolicyFull } from './use-cases/save-policy-full';
import { SaveYoloClass } from './use-cases/save-yolo-class';
import { SaveYoloSynonym } from './use-cases/save-yolo-synonym';
import { GetScoreBairro } from './use-cases/get-score-bairro';

@Module({
  providers: [
    GetPolicy,
    SavePolicy,
    GetPolicyFull,
    SavePolicyFull,
    GetDroneConfig,
    SaveDroneConfig,
    FilterYoloClasses,
    SaveYoloClass,
    FilterYoloSynonyms,
    SaveYoloSynonym,
    GetScoreBairro,
    JwtService,
    PrismaService,
  ],
  controllers: [RiskEngineController],
  imports: [DatabaseModule],
})
export class RiskEngineModule {}
