import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { RecorrenciasController } from './recorrencias.controller';
import { CountAtivasByCliente } from './use-cases/count-ativas-by-cliente';
import { ListAtivasByCliente } from './use-cases/list-ativas-by-cliente';
import { ListItensByRecorrencia } from './use-cases/list-itens-by-recorrencia';

@Module({
  imports: [DatabaseModule],
  controllers: [RecorrenciasController],
  providers: [ListAtivasByCliente, CountAtivasByCliente, ListItensByRecorrencia, JwtService, PrismaService],
})
export class RecorrenciasModule {}
