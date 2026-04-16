import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { BillingController } from './billing.controller';
import { CreateCiclo } from './use-cases/create-ciclo';
import { CreateClientePlano } from './use-cases/create-cliente-plano';
import { CreatePlano } from './use-cases/create-plano';
import { FilterCiclos } from './use-cases/filter-ciclos';
import { FilterPlanos } from './use-cases/filter-planos';
import { GetClientePlano } from './use-cases/get-cliente-plano';
import { GetQuotas } from './use-cases/get-quotas';
import { SavePlano } from './use-cases/save-plano';
import { UpsertQuotas } from './use-cases/upsert-quotas';
import { MeuUsoMensal } from './use-cases/meu-uso-mensal';
import { UsoMensalTodos } from './use-cases/uso-mensal-todos';
import { BillingSchedulerService } from './billing-scheduler.service';
import { VerificarQuota } from './use-cases/verificar-quota';

@Module({
  providers: [
    FilterPlanos,
    CreatePlano,
    SavePlano,
    GetClientePlano,
    CreateClientePlano,
    FilterCiclos,
    CreateCiclo,
    GetQuotas,
    UpsertQuotas,
    MeuUsoMensal,
    UsoMensalTodos,
    VerificarQuota,
    BillingSchedulerService,
    JwtService,
    PrismaService,
  ],
  controllers: [BillingController],
  exports: [BillingSchedulerService],
  imports: [DatabaseModule],
})
export class BillingModule {}
