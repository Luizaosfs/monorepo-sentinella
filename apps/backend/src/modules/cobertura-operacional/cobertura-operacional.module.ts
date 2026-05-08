import { Module } from '@nestjs/common';

import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CoberturaOperacionalController } from './cobertura-operacional.controller';
import { GetCoberturaAgentesUc } from './use-cases/get-cobertura-agentes';
import { GetCoberturaQuarteiroesSUc } from './use-cases/get-cobertura-quarteiroes';
import { GetImoveisNuncaVisitadosUc } from './use-cases/get-imoveis-nunca-visitados';
import { GetResumoCoberturaUc } from './use-cases/get-resumo-cobertura';

@Module({
  imports: [DatabaseModule],
  controllers: [CoberturaOperacionalController],
  providers: [
    PrismaService,
    GetResumoCoberturaUc,
    GetCoberturaQuarteiroesSUc,
    GetCoberturaAgentesUc,
    GetImoveisNuncaVisitadosUc,
  ],
})
export class CoberturaOperacionalModule {}
