import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { JobModule } from '../job/job.module';
import { ReinspecaoModule } from '../reinspecao/reinspecao.module';
import { SlaModule } from '../sla/sla.module';
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
import { CruzarFocoNovoComCasos } from './use-cases/cruzar-foco-novo-com-casos';
import { CriarFocoDeLevantamentoItem } from './use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { CriarFocoDeVistoriaDeposito } from './use-cases/auto-criacao/criar-foco-de-vistoria-deposito';
import { NormalizarCicloFoco } from './use-cases/normalizar-ciclo-foco';
import { RecalcularScorePrioridadeFoco } from './use-cases/recalcular-score-prioridade-foco';

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
    CruzarFocoNovoComCasos,
    CriarFocoDeLevantamentoItem,
    CriarFocoDeVistoriaDeposito,
    NormalizarCicloFoco,
    RecalcularScorePrioridadeFoco,
    JwtService,
    PrismaService,
  ],
  controllers: [FocoRiscoController],
  imports: [DatabaseModule, SlaModule, ReinspecaoModule, JobModule],
  exports: [CriarFocoDeLevantamentoItem, CriarFocoDeVistoriaDeposito, IniciarInspecao],
})
export class FocoRiscoModule {}
