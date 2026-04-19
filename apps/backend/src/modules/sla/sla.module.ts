import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { SlaController } from './sla.controller';
import { AtribuirAgente } from './use-cases/atribuir-agente';
import { ConcluirSla } from './use-cases/concluir-sla';
import { CountPendentes } from './use-cases/count-pendentes';
import { CreateFeriado } from './use-cases/create-feriado';
import { DeleteFeriado } from './use-cases/delete-feriado';
import { EscalarSla } from './use-cases/escalar-sla';
import { GetConfig } from './use-cases/get-config';
import { GetFocoConfig } from './use-cases/get-foco-config';
import { ListConfigRegioes } from './use-cases/list-config-regioes';
import { ListErrosCriacao } from './use-cases/list-erros-criacao';
import { ListFeriados } from './use-cases/list-feriados';
import { ListSla } from './use-cases/list-sla';
import { ListSlaPainel } from './use-cases/list-sla-painel';
import { ListSlaIminentes } from './use-cases/list-sla-iminentes';
import { PaginationSla } from './use-cases/pagination-sla';
import { ReabrirSla } from './use-cases/reabrir-sla';
import { SaveConfig } from './use-cases/save-config';
import { SaveFocoConfig } from './use-cases/save-foco-config';
import { UpdateSlaStatus } from './use-cases/update-sla-status';
import { SlaSchedulerService } from './sla-scheduler.service';
import { UpsertConfigRegiao } from './use-cases/upsert-config-regiao';
import { GetFocosRiscoAtivos } from './use-cases/get-focos-risco-ativos';

@Module({
  providers: [
    ListSla,
    PaginationSla,
    ListSlaPainel,
    ListSlaIminentes,
    CountPendentes,
    UpdateSlaStatus,
    EscalarSla,
    ReabrirSla,
    ConcluirSla,
    AtribuirAgente,
    GetConfig,
    SaveConfig,
    ListFeriados,
    CreateFeriado,
    DeleteFeriado,
    GetFocoConfig,
    SaveFocoConfig,
    ListConfigRegioes,
    UpsertConfigRegiao,
    ListErrosCriacao,
    GetFocosRiscoAtivos,
    SlaSchedulerService,
    JwtService,
    PrismaService,
  ],
  controllers: [SlaController],
  exports: [SlaSchedulerService],
  imports: [DatabaseModule],
})
export class SlaModule {}
