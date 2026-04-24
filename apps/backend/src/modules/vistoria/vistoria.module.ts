import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { BillingModule } from '../billing/billing.module';
import { FocoRiscoModule } from '../foco-risco/foco-risco.module';
import { IniciarInspecao } from '../foco-risco/use-cases/iniciar-inspecao';
import { JobModule } from '../job/job.module';
import { BackfillConsolidacaoService } from './services/backfill-consolidacao.service';
import { AddDeposito } from './use-cases/add-deposito';
import { ValidarCicloVistoria } from './use-cases/validar-ciclo-vistoria';
import { ConsolidarVistoria } from './use-cases/consolidar-vistoria';
import { AddRiscos } from './use-cases/add-riscos';
import { AddSintomas } from './use-cases/add-sintomas';
import { CountVistoria } from './use-cases/count-vistoria';
import { CreateVistoria } from './use-cases/create-vistoria';
import { CreateVistoriaCompleta } from './use-cases/create-vistoria-completa';
import { FilterVistoria } from './use-cases/filter-vistoria';
import { GetVistoria } from './use-cases/get-vistoria';
import { ListVistoriasConsolidadas } from './use-cases/list-vistorias-consolidadas';
import { PaginationVistoria } from './use-cases/pagination-vistoria';
import { SaveVistoria } from './use-cases/save-vistoria';
import { VistoriaController } from './vistoria.controller';

@Module({
  providers: [
    ConsolidarVistoria,
    BackfillConsolidacaoService,
    AddDeposito,
    AddSintomas,
    AddRiscos,
    CountVistoria,
    CreateVistoria,
    CreateVistoriaCompleta,
    GetVistoria,
    FilterVistoria,
    ListVistoriasConsolidadas,
    PaginationVistoria,
    SaveVistoria,
    ValidarCicloVistoria,
    IniciarInspecao,
    JwtService,
    PrismaService,
  ],
  controllers: [VistoriaController],
  imports: [DatabaseModule, FocoRiscoModule, JobModule, BillingModule],
})
export class VistoriaModule {}
