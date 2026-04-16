import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PlanoAcaoController } from './plano-acao.controller';
import { CreatePlanoAcao } from './use-cases/create-plano-acao';
import { DeletePlanoAcao } from './use-cases/delete-plano-acao';
import { FilterAllPlanoAcao } from './use-cases/filter-all';
import { FilterPlanoAcao } from './use-cases/filter-plano-acao';
import { SavePlanoAcao } from './use-cases/save-plano-acao';

@Module({
  providers: [
    FilterPlanoAcao,
    FilterAllPlanoAcao,
    CreatePlanoAcao,
    SavePlanoAcao,
    DeletePlanoAcao,
    JwtService,
    PrismaService,
  ],
  controllers: [PlanoAcaoController],
  imports: [DatabaseModule],
})
export class PlanoAcaoModule {}
