import { AuthModule } from '@modules/auth/auth.module';
import { DenunciaModule } from '@modules/denuncia/denuncia.module';
import { PilotoModule } from '@modules/piloto/piloto.module';
import { SeedModule } from '@modules/seed/seed.module';
import { BillingModule } from '@modules/billing/billing.module';
import { CicloModule } from '@modules/ciclo/ciclo.module';
import { ClienteModule } from '@modules/cliente/cliente.module';
import { CloudinaryModule } from '@modules/cloudinary/cloudinary.module';
import { CnesModule } from '@modules/cnes/cnes.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { DroneModule } from '@modules/drone/drone.module';
import { FocoRiscoModule } from '@modules/foco-risco/foco-risco.module';
import { ImovelModule } from '@modules/imovel/imovel.module';
import { JobModule } from '@modules/job/job.module';
import { LevantamentoModule } from '@modules/levantamento/levantamento.module';
import { NotificacaoModule } from '@modules/notificacao/notificacao.module';
import { OperacaoModule } from '@modules/operacao/operacao.module';
import { PlanejamentoModule } from '@modules/planejamento/planejamento.module';
import { RegiaoModule } from '@modules/regiao/regiao.module';
import { SlaModule } from '@modules/sla/sla.module';
import { UsuarioModule } from '@modules/usuario/usuario.module';
import { VistoriaModule } from '@modules/vistoria/vistoria.module';
import { PluvioModule } from '@modules/pluvio/pluvio.module';
import { RiskEngineModule } from '@modules/risk-engine/risk-engine.module';
import { QuarteiraoModule } from '@modules/quarteirao/quarteirao.module';
import { ReinspecaoModule } from '@modules/reinspecao/reinspecao.module';
import { PlanoAcaoModule } from '@modules/plano-acao/plano-acao.module';
import { IaModule } from '@modules/ia/ia.module';
import { AgrupamentosModule } from '@modules/agrupamentos/agrupamentos.module';
import { ImportLogModule } from '@modules/import-log/import-log.module';
import { AlertaRetornoModule } from '@modules/alerta-retorno/alerta-retorno.module';
import { RecorrenciasModule } from '@modules/recorrencias/recorrencias.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { DatabaseModule } from '@shared/modules/database/database.module';

@Module({
  imports: [
    ClsModule.forRoot({ middleware: { mount: true }, global: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      getTracker: (req) => {
        const forwarded = req.headers?.['x-forwarded-for'];
        if (forwarded) return String(forwarded).split(',')[0].trim();
        return req.ip ?? 'unknown';
      },
    }),
    DatabaseModule,
    AuthModule,
    UsuarioModule,
    ClienteModule,
    RegiaoModule,
    ImovelModule,
    CicloModule,
    LevantamentoModule,
    FocoRiscoModule,
    VistoriaModule,
    SlaModule,
    OperacaoModule,
    PlanejamentoModule,
    DroneModule,
    CloudinaryModule,
    NotificacaoModule,
    CnesModule,
    DashboardModule,
    BillingModule,
    JobModule,
    PluvioModule,
    RiskEngineModule,
    QuarteiraoModule,
    ReinspecaoModule,
    PlanoAcaoModule,
    IaModule,
    AgrupamentosModule,
    ImportLogModule,
    DenunciaModule,
    PilotoModule,
    SeedModule,
    AlertaRetornoModule,
    RecorrenciasModule,
  ],
  controllers: [],
  providers: [
    // Guard order matters: throttle → auth → roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
