import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { RegiaoController } from './regiao.controller';
import { RegiaoGeocodeService } from './regiao-geocode.service';
import { CreateRegiao } from './use-cases/create-regiao';
import { DeleteRegiao } from './use-cases/delete-regiao';
import { FilterRegiao } from './use-cases/filter-regiao';
import { GetRegiao } from './use-cases/get-regiao';
import { PaginationRegiao } from './use-cases/pagination-regiao';
import { SaveRegiao } from './use-cases/save-regiao';

@Module({
  providers: [
    CreateRegiao,
    DeleteRegiao,
    FilterRegiao,
    GetRegiao,
    PaginationRegiao,
    SaveRegiao,
    RegiaoGeocodeService,
    JwtService,
    PrismaService,
  ],
  controllers: [RegiaoController],
  imports: [DatabaseModule],
})
export class RegiaoModule {}
