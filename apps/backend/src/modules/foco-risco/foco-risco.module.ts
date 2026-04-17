import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { FocoRiscoController } from './foco-risco.controller';
import { AtribuirAgente } from './use-cases/atribuir-agente';
import { AtribuirAgenteLote } from './use-cases/atribuir-agente-lote';
import { AtualizarClassificacao } from './use-cases/atualizar-classificacao';
import { ContagemPorStatus } from './use-cases/contagem-por-status';
import { ContagemTriagemFila } from './use-cases/contagem-triagem-fila';
import { CreateFocoRisco } from './use-cases/create-foco-risco';
import { FilterFocoRisco } from './use-cases/filter-foco-risco';
import { GetFocoAtivoById } from './use-cases/get-foco-ativo-by-id';
import { GetFocoHistorico } from './use-cases/get-foco-historico';
import { GetFocoTimeline } from './use-cases/get-foco-timeline';
import { GetFocoRisco } from './use-cases/get-foco-risco';
import { IniciarInspecao } from './use-cases/iniciar-inspecao';
import { ListFocosByIds } from './use-cases/list-focos-by-ids';
import { PaginationFocoRisco } from './use-cases/pagination-foco-risco';
import { TransicionarFocoRisco } from './use-cases/transicionar-foco-risco';
import { UpdateFocoRisco } from './use-cases/update-foco-risco';

@Module({
  providers: [
    ContagemPorStatus,
    AtribuirAgente,
    AtribuirAgenteLote,
    AtualizarClassificacao,
    ContagemTriagemFila,
    CreateFocoRisco,
    FilterFocoRisco,
    GetFocoAtivoById,
    GetFocoHistorico,
    GetFocoTimeline,
    GetFocoRisco,
    IniciarInspecao,
    ListFocosByIds,
    PaginationFocoRisco,
    TransicionarFocoRisco,
    UpdateFocoRisco,
    JwtService,
    PrismaService,
  ],
  controllers: [FocoRiscoController],
  imports: [DatabaseModule],
})
export class FocoRiscoModule {}
