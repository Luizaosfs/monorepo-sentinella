import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CreateUsuario } from './use-cases/create-usuario';
import { FilterUsuario } from './use-cases/filter-usuario';
import { GetPapeisCliente } from './use-cases/get-papeis-cliente';
import { PaginationUsuario } from './use-cases/pagination-usuario';
import { UsuarioController } from './usuario.controller';

@Module({
  providers: [
    CreateUsuario,
    FilterUsuario,
    PaginationUsuario,
    GetPapeisCliente,
    JwtService,
    PrismaService,
  ],
  controllers: [UsuarioController],
  imports: [DatabaseModule],
})
export class UsuarioModule {}
