import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PlanejamentoController } from './planejamento.controller';
import { CreatePlanejamento } from './use-cases/create-planejamento';
import { DeletePlanejamento } from './use-cases/delete-planejamento';
import { FilterPlanejamento } from './use-cases/filter-planejamento';
import { GetAtivos } from './use-cases/get-ativos';
import { GetAtivosManuais } from './use-cases/get-ativos-manuais';
import { GetPlanejamento } from './use-cases/get-planejamento';
import { SavePlanejamento } from './use-cases/save-planejamento';
import { ListWithCliente } from './use-cases/list-with-cliente';
import { VoosByPlanejamento } from './use-cases/voos-by-planejamento';

@Module({
  providers: [
    FilterPlanejamento,
    GetAtivos,
    GetAtivosManuais,
    GetPlanejamento,
    CreatePlanejamento,
    SavePlanejamento,
    DeletePlanejamento,
    ListWithCliente,
    VoosByPlanejamento,
    JwtService,
    PrismaService,
  ],
  controllers: [PlanejamentoController],
  imports: [DatabaseModule],
})
export class PlanejamentoModule {}
