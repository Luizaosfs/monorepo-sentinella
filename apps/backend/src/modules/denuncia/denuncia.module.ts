import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { ResolverTerritorioPorCoordenada } from '../notificacao/use-cases/resolver-territorio-por-coordenada';
import { ResolverAgentePorQuadra } from '../notificacao/use-cases/resolver-agente-por-quadra';
import { DenunciaController } from './denuncia.controller';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadaoV2 } from './use-cases/denunciar-cidadao-v2';
import { CanalCidadaoStats } from './use-cases/canal-cidadao-stats';
import { EnfileirarNotifCanalCidadao } from './use-cases/enfileirar-notif-canal-cidadao';
import { GeocodificarEndereco } from './use-cases/geocodificar-endereco';
import { UploadFotoDenuncia } from './use-cases/upload-foto-denuncia';

@Module({
  imports: [DatabaseModule, CloudinaryModule],
  controllers: [DenunciaController],
  providers: [DenunciarCidadaoV2, ConsultarDenuncia, CanalCidadaoStats, EnfileirarNotifCanalCidadao, UploadFotoDenuncia, GeocodificarEndereco, ResolverTerritorioPorCoordenada, ResolverAgentePorQuadra, JwtService, PrismaService],
})
export class DenunciaModule {}
