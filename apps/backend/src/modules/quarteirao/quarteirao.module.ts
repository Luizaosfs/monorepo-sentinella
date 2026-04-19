import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { QuarteiraoController } from './quarteirao.controller';
import { CoberturaCiclo } from './use-cases/cobertura-ciclo';
import { CopiarDistribuicao } from './use-cases/copiar-distribuicao';
import { CreateDistribuicao } from './use-cases/create-distribuicao';
import { CreateQuarteirao } from './use-cases/create-quarteirao';
import { DeleteDistribuicao } from './use-cases/delete-distribuicao';
import { DeleteQuarteirao } from './use-cases/delete-quarteirao';
import { FilterDistribuicoes } from './use-cases/filter-distribuicoes';
import { FilterQuarteiroes } from './use-cases/filter-quarteiroes';
import { ListDistribuicoesByAgente } from './use-cases/list-distribuicoes-by-agente';
import { UpsertDistribuicoes } from './use-cases/upsert-distribuicoes';
import { DeletarDistribuicoes } from './use-cases/deletar-distribuicoes';

@Module({
  providers: [
    FilterQuarteiroes,
    CreateQuarteirao,
    DeleteQuarteirao,
    FilterDistribuicoes,
    CreateDistribuicao,
    CopiarDistribuicao,
    CoberturaCiclo,
    DeleteDistribuicao,
    ListDistribuicoesByAgente,
    UpsertDistribuicoes,
    DeletarDistribuicoes,
    JwtService,
    PrismaService,
  ],
  controllers: [QuarteiraoController],
  imports: [DatabaseModule],
})
export class QuarteiraoModule {}
