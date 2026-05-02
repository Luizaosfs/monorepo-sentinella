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

// Executivo
import { GetExecutivoKpis } from './use-cases/get-executivo-kpis';
import { GetExecutivoTendencia } from './use-cases/get-executivo-tendencia';
import { GetExecutivoCobertura } from './use-cases/get-executivo-cobertura';
import { GetExecutivoBairrosVariacao } from './use-cases/get-executivo-bairros-variacao';
import { GetExecutivoComparativoCiclos } from './use-cases/get-executivo-comparativo-ciclos';

// Regional / Analytics
import { GetRegionalComparativo } from './use-cases/get-regional-comparativo';
import { GetRegionalEvolucao } from './use-cases/get-regional-evolucao';
import { GetRegionalMunicipioDetalhe } from './use-cases/get-regional-municipio-detalhe';
import { GetRegionalKpi } from './use-cases/get-regional-kpi';
import { GetRegionalRelatorioCSV } from './use-cases/get-regional-relatorio-csv';
import { GetRegionalRelatorioPDF } from './use-cases/get-regional-relatorio-pdf';
import { GetRegionalResumo } from './use-cases/get-regional-resumo';
import { GetRegionalSla } from './use-cases/get-regional-sla';
import { GetRegionalUso } from './use-cases/get-regional-uso';
import { GetRegionalVulnerabilidade } from './use-cases/get-regional-vulnerabilidade';

// Analítico
import { GetAnaliticoBairros } from './use-cases/get-analitico-bairros';
import { GetAnaliticoResumo } from './use-cases/get-analitico-resumo';
import { GetAnaliticoRiscoTerritorial } from './use-cases/get-analitico-risco-territorial';
import { GetAnaliticoVulnerabilidade } from './use-cases/get-analitico-vulnerabilidade';
import { GetAnaliticoAlertaSaude } from './use-cases/get-analitico-alerta-saude';
import { GetAnaliticoResultadoOperacional } from './use-cases/get-analitico-resultado-operacional';
import { GetAnaliticoImoveisCriticos } from './use-cases/get-analitico-imoveis-criticos';

// Piloto
import { GetPilotoFunilHoje } from './use-cases/get-piloto-funil-hoje';
import { GetPilotoDespachosSupervisor } from './use-cases/get-piloto-despachos-supervisor';
import { GetPilotoProdAgentes } from './use-cases/get-piloto-prod-agentes';

// Reincidência
import { GetReincidenciaImoveis } from './use-cases/get-reincidencia-imoveis';
import { GetReincidenciaPorDeposito } from './use-cases/get-reincidencia-por-deposito';
import { GetReincidenciaSazonalidade } from './use-cases/get-reincidencia-sazonalidade';

// Eficácia
import { GetEficaciaTratamento } from './use-cases/get-eficacia-tratamento';
import { TriggerHealthCheck } from './use-cases/trigger-health-check';
import { GerarResumoDiario } from './use-cases/gerar-resumo-diario';

@Module({
  providers: [
    // Legado
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
    // Executivo
    GetExecutivoKpis,
    GetExecutivoTendencia,
    GetExecutivoCobertura,
    GetExecutivoBairrosVariacao,
    GetExecutivoComparativoCiclos,
    // Regional
    GetRegionalComparativo,
    GetRegionalEvolucao,
    GetRegionalMunicipioDetalhe,
    GetRegionalKpi,
    GetRegionalRelatorioCSV,
    GetRegionalRelatorioPDF,
    GetRegionalResumo,
    GetRegionalSla,
    GetRegionalUso,
    GetRegionalVulnerabilidade,
    // Analítico
    GetAnaliticoBairros,
    GetAnaliticoResumo,
    GetAnaliticoRiscoTerritorial,
    GetAnaliticoVulnerabilidade,
    GetAnaliticoAlertaSaude,
    GetAnaliticoResultadoOperacional,
    GetAnaliticoImoveisCriticos,
    // Piloto
    GetPilotoFunilHoje,
    GetPilotoDespachosSupervisor,
    GetPilotoProdAgentes,
    // Reincidência
    GetReincidenciaImoveis,
    GetReincidenciaPorDeposito,
    GetReincidenciaSazonalidade,
    // Eficácia
    GetEficaciaTratamento,
    TriggerHealthCheck,
    GerarResumoDiario,
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
