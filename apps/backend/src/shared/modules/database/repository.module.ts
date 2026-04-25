import { Module } from '@nestjs/common';
import { PRISMA_REPOSITORY_METADATA } from 'src/decorators/prisma-repository.decorator';

import { PrismaContext } from './prisma/prisma.context';
import { PrismaService } from './prisma/prisma.service';
import { PrismaBillingReadRepository } from './prisma/repositories/billing/prisma-billing-read.repository';
import { PrismaBillingWriteRepository } from './prisma/repositories/billing/prisma-billing-write.repository';
import { PrismaCicloReadRepository } from './prisma/repositories/ciclo/prisma-ciclo-read.repository';
import { PrismaCicloWriteRepository } from './prisma/repositories/ciclo/prisma-ciclo-write.repository';
import { PrismaClienteReadRepository } from './prisma/repositories/cliente/prisma-cliente-read.repository';
import { PrismaClienteWriteRepository } from './prisma/repositories/cliente/prisma-cliente-write.repository';
import { PrismaPesosConsolidacaoReadRepository } from './prisma/repositories/consolidacao-pesos-config/prisma-pesos-consolidacao-read.repository';
import { PrismaDashboardReadRepository } from './prisma/repositories/dashboard/prisma-dashboard-read.repository';
import { PrismaDashboardWriteRepository } from './prisma/repositories/dashboard/prisma-dashboard-write.repository';
import { PrismaDroneReadRepository } from './prisma/repositories/drone/prisma-drone-read.repository';
import { PrismaDroneWriteRepository } from './prisma/repositories/drone/prisma-drone-write.repository';
import { PrismaFocoRiscoReadRepository } from './prisma/repositories/foco-risco/prisma-foco-risco-read.repository';
import { PrismaFocoRiscoWriteRepository } from './prisma/repositories/foco-risco/prisma-foco-risco-write.repository';
import { PrismaImovelReadRepository } from './prisma/repositories/imovel/prisma-imovel-read.repository';
import { PrismaImovelWriteRepository } from './prisma/repositories/imovel/prisma-imovel-write.repository';
import { PrismaImportLogReadRepository } from './prisma/repositories/import-log/prisma-import-log-read.repository';
import { PrismaImportLogWriteRepository } from './prisma/repositories/import-log/prisma-import-log-write.repository';
import { PrismaJobReadRepository } from './prisma/repositories/job/prisma-job-read.repository';
import { PrismaJobWriteRepository } from './prisma/repositories/job/prisma-job-write.repository';
import { PrismaLevantamentoReadRepository } from './prisma/repositories/levantamento/prisma-levantamento-read.repository';
import { PrismaLevantamentoWriteRepository } from './prisma/repositories/levantamento/prisma-levantamento-write.repository';
import { PrismaNotificacaoReadRepository } from './prisma/repositories/notificacao/prisma-notificacao-read.repository';
import { PrismaNotificacaoWriteRepository } from './prisma/repositories/notificacao/prisma-notificacao-write.repository';
import { PrismaOperacaoReadRepository } from './prisma/repositories/operacao/prisma-operacao-read.repository';
import { PrismaOperacaoWriteRepository } from './prisma/repositories/operacao/prisma-operacao-write.repository';
import { PrismaPlanejamentoReadRepository } from './prisma/repositories/planejamento/prisma-planejamento-read.repository';
import { PrismaPlanejamentoWriteRepository } from './prisma/repositories/planejamento/prisma-planejamento-write.repository';
import { PrismaPlanoAcaoReadRepository } from './prisma/repositories/plano-acao/prisma-plano-acao-read.repository';
import { PrismaPlanoAcaoWriteRepository } from './prisma/repositories/plano-acao/prisma-plano-acao-write.repository';
import { PrismaPluvioReadRepository } from './prisma/repositories/pluvio/prisma-pluvio-read.repository';
import { PrismaPluvioWriteRepository } from './prisma/repositories/pluvio/prisma-pluvio-write.repository';
import { PrismaQuarteiraoReadRepository } from './prisma/repositories/quarteirao/prisma-quarteirao-read.repository';
import { PrismaQuarteiraoWriteRepository } from './prisma/repositories/quarteirao/prisma-quarteirao-write.repository';
import { PrismaRegiaoReadRepository } from './prisma/repositories/regiao/prisma-regiao-read.repository';
import { PrismaRegiaoWriteRepository } from './prisma/repositories/regiao/prisma-regiao-write.repository';
import { PrismaReinspecaoReadRepository } from './prisma/repositories/reinspecao/prisma-reinspecao-read.repository';
import { PrismaReinspecaoWriteRepository } from './prisma/repositories/reinspecao/prisma-reinspecao-write.repository';
import { PrismaRiskEngineReadRepository } from './prisma/repositories/risk-engine/prisma-risk-engine-read.repository';
import { PrismaRiskEngineWriteRepository } from './prisma/repositories/risk-engine/prisma-risk-engine-write.repository';
import { PrismaSlaReadRepository } from './prisma/repositories/sla/prisma-sla-read.repository';
import { PrismaSlaWriteRepository } from './prisma/repositories/sla/prisma-sla-write.repository';
import { PrismaUsuarioReadRepository } from './prisma/repositories/usuario/prisma-usuario-read.repository';
import { PrismaUsuarioWriteRepository } from './prisma/repositories/usuario/prisma-usuario-write.repository';
import { PrismaVistoriaReadRepository } from './prisma/repositories/vistoria/prisma-vistoria-read.repository';
import { PrismaVistoriaWriteRepository } from './prisma/repositories/vistoria/prisma-vistoria-write.repository';

const ALL_REPOSITORIES = [
  PrismaBillingReadRepository,
  PrismaBillingWriteRepository,
  PrismaCicloReadRepository,
  PrismaCicloWriteRepository,
  PrismaClienteReadRepository,
  PrismaClienteWriteRepository,
  PrismaPesosConsolidacaoReadRepository,
  PrismaDashboardReadRepository,
  PrismaDashboardWriteRepository,
  PrismaDroneReadRepository,
  PrismaDroneWriteRepository,
  PrismaFocoRiscoReadRepository,
  PrismaFocoRiscoWriteRepository,
  PrismaImovelReadRepository,
  PrismaImovelWriteRepository,
  PrismaImportLogReadRepository,
  PrismaImportLogWriteRepository,
  PrismaJobReadRepository,
  PrismaJobWriteRepository,
  PrismaLevantamentoReadRepository,
  PrismaLevantamentoWriteRepository,
  PrismaNotificacaoReadRepository,
  PrismaNotificacaoWriteRepository,
  PrismaOperacaoReadRepository,
  PrismaOperacaoWriteRepository,
  PrismaPlanejamentoReadRepository,
  PrismaPlanejamentoWriteRepository,
  PrismaPlanoAcaoReadRepository,
  PrismaPlanoAcaoWriteRepository,
  PrismaPluvioReadRepository,
  PrismaPluvioWriteRepository,
  PrismaQuarteiraoReadRepository,
  PrismaQuarteiraoWriteRepository,
  PrismaRegiaoReadRepository,
  PrismaRegiaoWriteRepository,
  PrismaReinspecaoReadRepository,
  PrismaReinspecaoWriteRepository,
  PrismaRiskEngineReadRepository,
  PrismaRiskEngineWriteRepository,
  PrismaSlaReadRepository,
  PrismaSlaWriteRepository,
  PrismaUsuarioReadRepository,
  PrismaUsuarioWriteRepository,
  PrismaVistoriaReadRepository,
  PrismaVistoriaWriteRepository,
];

const repositoryProviders = ALL_REPOSITORIES.map((repo) =>
  Reflect.getMetadata(PRISMA_REPOSITORY_METADATA, repo),
).filter(Boolean);

@Module({
  providers: [...repositoryProviders, PrismaService, PrismaContext],
  exports: repositoryProviders.map((p) => p.provide),
})
export class RepositoryModule {}
