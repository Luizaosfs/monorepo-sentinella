import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { DenunciaController } from './denuncia.controller';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadao } from './use-cases/denunciar-cidadao';
import { DenunciarCidadaoV2 } from './use-cases/denunciar-cidadao-v2';
import { CanalCidadaoStats } from './use-cases/canal-cidadao-stats';

@Module({
  imports: [DatabaseModule],
  controllers: [DenunciaController],
  providers: [DenunciarCidadao, DenunciarCidadaoV2, ConsultarDenuncia, CanalCidadaoStats, JwtService, PrismaService],
})
export class DenunciaModule {}
