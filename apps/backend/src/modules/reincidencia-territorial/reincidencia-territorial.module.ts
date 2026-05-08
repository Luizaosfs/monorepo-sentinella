import { Module } from '@nestjs/common';

import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ReincidenciaTerritorialController } from './reincidencia-territorial.controller';
import { GetReincidenciaBairrosUc } from './use-cases/get-reincidencia-bairros';
import { GetReincidenciaImoveisUc } from './use-cases/get-reincidencia-imoveis';
import { GetReincidenciaQuarteiroesuUc } from './use-cases/get-reincidencia-quarteiroes';
import { GetResumoReincidenciaUc } from './use-cases/get-resumo-reincidencia';

@Module({
  imports: [DatabaseModule],
  controllers: [ReincidenciaTerritorialController],
  providers: [
    PrismaService,
    GetResumoReincidenciaUc,
    GetReincidenciaImoveisUc,
    GetReincidenciaQuarteiroesuUc,
    GetReincidenciaBairrosUc,
  ],
})
export class ReincidenciaTerritorialModule {}
