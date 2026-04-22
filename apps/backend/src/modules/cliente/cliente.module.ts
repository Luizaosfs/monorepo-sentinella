import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ClienteController } from './cliente.controller';
import { CreateCliente } from './use-cases/create-cliente';
import { FilterCliente } from './use-cases/filter-cliente';
import { GetCliente } from './use-cases/get-cliente';
import { GetIntegracaoApiKey } from './use-cases/get-integracao-api-key';
import { GetIntegracoes } from './use-cases/get-integracoes';
import { PaginationCliente } from './use-cases/pagination-cliente';
import { ResolverPorCoordenada } from './use-cases/resolver-por-coordenada';
import { SaveCliente } from './use-cases/save-cliente';
import { SeedClienteNovo } from './use-cases/seed-cliente-novo';
import { TestarIntegracao } from './use-cases/testar-integracao';
import { UpdateIntegracaoMeta } from './use-cases/update-integracao-meta';
import { UpsertIntegracao } from './use-cases/upsert-integracao';

@Module({
  providers: [
    CreateCliente,
    FilterCliente,
    GetCliente,
    PaginationCliente,
    SaveCliente,
    SeedClienteNovo,
    ResolverPorCoordenada,
    GetIntegracaoApiKey,
    GetIntegracoes,
    UpsertIntegracao,
    UpdateIntegracaoMeta,
    TestarIntegracao,
    JwtService,
    PrismaService,
  ],
  controllers: [ClienteController],
  imports: [DatabaseModule],
})
export class ClienteModule {}
