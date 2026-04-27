import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { DenunciaController } from './denuncia.controller';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadaoV2 } from './use-cases/denunciar-cidadao-v2';
import { CanalCidadaoStats } from './use-cases/canal-cidadao-stats';
import { EnfileirarNotifCanalCidadao } from './use-cases/enfileirar-notif-canal-cidadao';
import { UploadFotoDenuncia } from './use-cases/upload-foto-denuncia';

@Module({
  imports: [DatabaseModule, CloudinaryModule],
  controllers: [DenunciaController],
  providers: [DenunciarCidadaoV2, ConsultarDenuncia, CanalCidadaoStats, EnfileirarNotifCanalCidadao, UploadFotoDenuncia, JwtService, PrismaService],
})
export class DenunciaModule {}
