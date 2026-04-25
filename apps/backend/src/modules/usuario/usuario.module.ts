import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { BillingModule } from '../billing/billing.module';

import { AtribuirPapel } from './use-cases/atribuir-papel';
import { CreateUsuario } from './use-cases/create-usuario';
import { DeleteUsuario } from './use-cases/delete-usuario';
import { FilterUsuario } from './use-cases/filter-usuario';
import { GetPapeisCliente } from './use-cases/get-papeis-cliente';
import { GetUsuario } from './use-cases/get-usuario';
import { PaginationUsuario } from './use-cases/pagination-usuario';
import { SaveUsuario } from './use-cases/save-usuario';
import { UsuarioController } from './usuario.controller';

@Module({
  providers: [
    AtribuirPapel,
    CreateUsuario,
    FilterUsuario,
    PaginationUsuario,
    GetPapeisCliente,
    GetUsuario,
    SaveUsuario,
    DeleteUsuario,
    JwtService,
    PrismaService,
  ],
  controllers: [UsuarioController],
  imports: [DatabaseModule, BillingModule],
})
export class UsuarioModule {}
