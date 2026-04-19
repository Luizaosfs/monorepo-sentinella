import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { NotificacaoController } from './notificacao.controller';
import { CreateCaso } from './use-cases/create-caso';
import { CreateEsus } from './use-cases/create-esus';
import { CreatePush } from './use-cases/create-push';
import { CreateUnidade } from './use-cases/create-unidade';
import { DeleteCaso } from './use-cases/delete-caso';
import { DeletePush } from './use-cases/delete-push';
import { DeleteUnidade } from './use-cases/delete-unidade';
import { FilterCasos } from './use-cases/filter-casos';
import { EnviarEsus } from './use-cases/enviar-esus';
import { FilterEsus } from './use-cases/filter-esus';
import { FilterUnidades } from './use-cases/filter-unidades';
import { ReenviarEsus } from './use-cases/reenviar-esus';
import { GetCaso } from './use-cases/get-caso';
import { CanalCidadaoService } from './canal-cidadao.service';
import { ListarNoRaio } from './use-cases/listar-no-raio';
import { PushService } from './push.service';
import { PaginationCasos } from './use-cases/pagination-casos';
import { ProximoProtocolo } from './use-cases/proximo-protocolo';
import { SaveCaso } from './use-cases/save-caso';
import { SaveUnidade } from './use-cases/save-unidade';
import { CountCruzadosHoje } from './use-cases/count-cruzados-hoje';
import { CountProximosAoItem } from './use-cases/count-proximos-ao-item';
import { CruzamentosDocaso } from './use-cases/cruzamentos-do-caso';
import { CruzamentosDoItem } from './use-cases/cruzamentos-do-item';
import { ListarCasosPaginado } from './use-cases/listar-casos-paginado';
import { ListCasoIdsComCruzamento } from './use-cases/list-caso-ids-com-cruzamento';
import { ListCruzamentos } from './use-cases/list-cruzamentos';

@Module({
  providers: [
    FilterUnidades,
    CreateUnidade,
    SaveUnidade,
    DeleteUnidade,
    FilterCasos,
    GetCaso,
    CreateCaso,
    SaveCaso,
    DeleteCaso,
    CreatePush,
    DeletePush,
    FilterEsus,
    CreateEsus,
    EnviarEsus,
    ReenviarEsus,
    PaginationCasos,
    ListarNoRaio,
    ProximoProtocolo,
    PushService,
    CanalCidadaoService,
    ListarCasosPaginado,
    CountProximosAoItem,
    CruzamentosDoItem,
    CruzamentosDocaso,
    CountCruzadosHoje,
    ListCasoIdsComCruzamento,
    ListCruzamentos,
    JwtService,
    PrismaService,
  ],
  exports: [PushService, CanalCidadaoService],
  controllers: [NotificacaoController],
  imports: [DatabaseModule],
})
export class NotificacaoModule {}
