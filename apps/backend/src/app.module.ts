import { AgrupamentosModule } from '@modules/agrupamentos/agrupamentos.module';
import { AlertaRetornoModule } from '@modules/alerta-retorno/alerta-retorno.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BillingModule } from '@modules/billing/billing.module';
import { CicloModule } from '@modules/ciclo/ciclo.module';
import { ClienteModule } from '@modules/cliente/cliente.module';
import { CloudinaryModule } from '@modules/cloudinary/cloudinary.module';
import { CnesModule } from '@modules/cnes/cnes.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { DenunciaModule } from '@modules/denuncia/denuncia.module';
import { DroneModule } from '@modules/drone/drone.module';
import { FocoRiscoModule } from '@modules/foco-risco/foco-risco.module';
import { IaModule } from '@modules/ia/ia.module';
import { ImovelModule } from '@modules/imovel/imovel.module';
import { ImportLogModule } from '@modules/import-log/import-log.module';
import { JobModule } from '@modules/job/job.module';
import { LevantamentoModule } from '@modules/levantamento/levantamento.module';
import { NotificacaoModule } from '@modules/notificacao/notificacao.module';
import { OperacaoModule } from '@modules/operacao/operacao.module';
import { PilotoModule } from '@modules/piloto/piloto.module';
import { PlanejamentoModule } from '@modules/planejamento/planejamento.module';
import { PlanoAcaoModule } from '@modules/plano-acao/plano-acao.module';
import { PluvioModule } from '@modules/pluvio/pluvio.module';
import { QuarteiraoModule } from '@modules/quarteirao/quarteirao.module';
import { RecorrenciasModule } from '@modules/recorrencias/recorrencias.module';
import { RegiaoModule } from '@modules/regiao/regiao.module';
import { ReinspecaoModule } from '@modules/reinspecao/reinspecao.module';
import { RiskEngineModule } from '@modules/risk-engine/risk-engine.module';
import { SeedModule } from '@modules/seed/seed.module';
import { SlaModule } from '@modules/sla/sla.module';
import { UsuarioModule } from '@modules/usuario/usuario.module';
import { VistoriaModule } from '@modules/vistoria/vistoria.module';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { ClsModule } from 'nestjs-cls';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { UserContextInterceptor } from 'src/shared/interceptors/user-context.interceptor';

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
    // Guard order matters: throttle → auth → roles → tenant
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    // Interceptor global: propaga request.user.id para CLS (usado pelo
    // createdByExtension para popular created_by/alterado_por/updated_by).
    { provide: APP_INTERCEPTOR, useClass: UserContextInterceptor },
  ],
})
export class AppModule {}
