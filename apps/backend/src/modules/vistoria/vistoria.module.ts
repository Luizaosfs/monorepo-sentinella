import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CreateVistoria } from './use-cases/create-vistoria';
import { CreateVistoriaCompleta } from './use-cases/create-vistoria-completa';
import { FilterVistoria } from './use-cases/filter-vistoria';
import { GetVistoria } from './use-cases/get-vistoria';
import { PaginationVistoria } from './use-cases/pagination-vistoria';
import { SaveVistoria } from './use-cases/save-vistoria';
import { VistoriaController } from './vistoria.controller';

@Module({
  providers: [
    CreateVistoria,
    CreateVistoriaCompleta,
    GetVistoria,
    FilterVistoria,
    PaginationVistoria,
    SaveVistoria,
    JwtService,
    PrismaService,
  ],
  controllers: [VistoriaController],
  imports: [DatabaseModule],
})
export class VistoriaModule {}
