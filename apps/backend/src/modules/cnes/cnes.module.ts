import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CnesController } from './cnes.controller';
import { CnesScheduler } from './cnes.scheduler';
import { CnesService } from './cnes.service';
import { CnesEmAndamento } from './use-cases/cnes-em-andamento';
import { ListarControleCnes } from './use-cases/listar-controle-cnes';
import { ListarLogCnes } from './use-cases/listar-log-cnes';
import { SincronizarCnes } from './use-cases/sincronizar-cnes';

@Module({
  providers: [
    CnesService,
    CnesScheduler,
    SincronizarCnes,
    ListarControleCnes,
    ListarLogCnes,
    CnesEmAndamento,
    JwtService,
    PrismaService,
  ],
  controllers: [CnesController],
  exports: [CnesService],
  imports: [DatabaseModule],
})
export class CnesModule {}
