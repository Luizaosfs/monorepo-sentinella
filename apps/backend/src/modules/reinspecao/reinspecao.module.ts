import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ReinspecaoController } from './reinspecao.controller';
import { ReinspecaoScheduler } from './reinspecao.scheduler';
import { CancelarReinspecao } from './use-cases/cancelar';
import { CancelarReinspecoesAoFecharFoco } from './use-cases/cancelar-reinspecoes-ao-fechar-foco';
import { CountReinspecoesPendentes } from './use-cases/count-pendentes';
import { CriarManual } from './use-cases/criar-manual';
import { CriarReinspecaoPosTratamento } from './use-cases/criar-reinspecao-pos-tratamento';
import { FilterReinspecoes } from './use-cases/filter-reinspecoes';
import { GetReinspecao } from './use-cases/get-reinspecao';
import { MarcarVencidas } from './use-cases/marcar-vencidas';
import { ReagendarReinspecao } from './use-cases/reagendar';
import { RegistrarResultadoReinspecao } from './use-cases/registrar-resultado';

@Module({
  providers: [
    FilterReinspecoes,
    CountReinspecoesPendentes,
    GetReinspecao,
    CriarManual,
    CancelarReinspecao,
    ReagendarReinspecao,
    RegistrarResultadoReinspecao,
    MarcarVencidas,
    CriarReinspecaoPosTratamento,
    CancelarReinspecoesAoFecharFoco,
    ReinspecaoScheduler,
    JwtService,
    PrismaService,
  ],
  controllers: [ReinspecaoController],
  exports: [CriarReinspecaoPosTratamento, CancelarReinspecoesAoFecharFoco],
  imports: [DatabaseModule],
})
export class ReinspecaoModule {}
