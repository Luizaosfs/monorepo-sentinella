import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AnalyticsController } from './analytics.controller';
import { AnaliticoController } from './analitico.controller';
import { DashboardController } from './dashboard.controller';
import { EficaciaController } from './eficacia.controller';
import { ExecutivoController } from './executivo.controller';
import { HealthController } from './health.controller';
import { PilotoController } from './piloto.controller';
import { ReincidenciaController } from './reincidencia.controller';
import { CalcularLiraa } from './use-cases/calcular-liraa';
import { GetCentralKpis } from './use-cases/get-central-kpis';
import { ListImoveisParaHoje } from './use-cases/list-imoveis-para-hoje';
import { ComparativoAgentes } from './use-cases/comparativo-agentes';
import { ConsumoLarvicida } from './use-cases/consumo-larvicida';
import { CreateRelatorio } from './use-cases/create-relatorio';
import { FilterAlerts } from './use-cases/filter-alerts';
import { FilterHealth } from './use-cases/filter-health';
import { FilterRelatorios } from './use-cases/filter-relatorios';
import { FilterResumos } from './use-cases/filter-resumos';
import { DashboardSchedulerService } from './dashboard-scheduler.service';
import { HealthCheckService } from './health-check.service';
import { LiraaExportService } from './liraa-export.service';
import { GerarRelatorioAnalitico } from './use-cases/gerar-relatorio-analitico';
import { ResolverAlert } from './use-cases/resolver-alert';
import { ResumoAgente } from './use-cases/resumo-agente';
import { ResumoRegional } from './use-cases/resumo-regional';
import { ScoreSurtoRegioes } from './use-cases/score-surto-regioes';

@Module({
  providers: [
    FilterResumos,
    FilterRelatorios,
    CreateRelatorio,
    FilterHealth,
    FilterAlerts,
    ResolverAlert,
    GetCentralKpis,
    ListImoveisParaHoje,
    CalcularLiraa,
    ComparativoAgentes,
    ConsumoLarvicida,
    ResumoRegional,
    ScoreSurtoRegioes,
    ResumoAgente,
    GerarRelatorioAnalitico,
    DashboardSchedulerService,
    HealthCheckService,
    LiraaExportService,
    JwtService,
    PrismaService,
  ],
  controllers: [
    DashboardController,
    HealthController,
    AnalyticsController,
    ExecutivoController,
    PilotoController,
    AnaliticoController,
    ReincidenciaController,
    EficaciaController,
  ],
  exports: [DashboardSchedulerService, HealthCheckService, LiraaExportService],
  imports: [DatabaseModule],
})
export class DashboardModule {}
