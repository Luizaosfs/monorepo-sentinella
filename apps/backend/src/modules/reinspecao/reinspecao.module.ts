import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ReinspecaoController } from './reinspecao.controller';
import { ReinspecaoScheduler } from './reinspecao.scheduler';
import { CancelarReinspecao } from './use-cases/cancelar';
import { CriarManual } from './use-cases/criar-manual';
import { FilterReinspecoes } from './use-cases/filter-reinspecoes';
import { GetReinspecao } from './use-cases/get-reinspecao';
import { MarcarVencidas } from './use-cases/marcar-vencidas';
import { ReagendarReinspecao } from './use-cases/reagendar';
import { RegistrarResultadoReinspecao } from './use-cases/registrar-resultado';

@Module({
  providers: [
    FilterReinspecoes,
    GetReinspecao,
    CriarManual,
    CancelarReinspecao,
    ReagendarReinspecao,
    RegistrarResultadoReinspecao,
    MarcarVencidas,
    ReinspecaoScheduler,
    JwtService,
    PrismaService,
  ],
  controllers: [ReinspecaoController],
  imports: [DatabaseModule],
})
export class ReinspecaoModule {}
