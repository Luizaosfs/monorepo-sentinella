import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImplantacaoOperacionalController } from './implantacao-operacional.controller';
import { GerarOperacaoInicial } from './use-cases/gerar-operacao-inicial';
import { GetStatusImplantacao } from './use-cases/get-status-implantacao';
import { IniciarImplantacao } from './use-cases/iniciar-implantacao';

@Module({
  imports: [DatabaseModule],
  controllers: [ImplantacaoOperacionalController],
  providers: [GetStatusImplantacao, IniciarImplantacao, GerarOperacaoInicial, JwtService, PrismaService],
})
export class ImplantacaoOperacionalModule {}
