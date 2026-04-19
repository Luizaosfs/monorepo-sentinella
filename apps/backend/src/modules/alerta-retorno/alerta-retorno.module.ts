import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AlertaRetornoController } from './alerta-retorno.controller';
import { ListAlertasByAgente } from './use-cases/list-alertas-by-agente';
import { ResolverAlerta } from './use-cases/resolver-alerta';

@Module({
  imports: [DatabaseModule],
  controllers: [AlertaRetornoController],
  providers: [ListAlertasByAgente, ResolverAlerta, JwtService, PrismaService],
})
export class AlertaRetornoModule {}
