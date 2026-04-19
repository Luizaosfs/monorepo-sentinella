import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AgrupamentosController } from './agrupamentos.controller';
import { TagsController } from './tags.controller';
import { AddAgrupamentoCliente } from './use-cases/add-agrupamento-cliente';
import { CreateAgrupamento } from './use-cases/create-agrupamento';
import { FilterAgrupamentos } from './use-cases/filter-agrupamentos';
import { ListAgrupamentoClientes } from './use-cases/list-agrupamento-clientes';
import { ListTags } from './use-cases/list-tags';
import { RemoveAgrupamentoCliente } from './use-cases/remove-agrupamento-cliente';
import { UpdateAgrupamento } from './use-cases/update-agrupamento';

@Module({
  providers: [
    FilterAgrupamentos,
    CreateAgrupamento,
    UpdateAgrupamento,
    ListAgrupamentoClientes,
    AddAgrupamentoCliente,
    RemoveAgrupamentoCliente,
    ListTags,
    JwtService,
    PrismaService,
  ],
  controllers: [AgrupamentosController, TagsController],
  imports: [DatabaseModule],
})
export class AgrupamentosModule {}
