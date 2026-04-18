import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { DenunciaController } from './denuncia.controller';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadao } from './use-cases/denunciar-cidadao';

@Module({
  imports: [DatabaseModule],
  controllers: [DenunciaController],
  providers: [DenunciarCidadao, ConsultarDenuncia, JwtService, PrismaService],
})
export class DenunciaModule {}
