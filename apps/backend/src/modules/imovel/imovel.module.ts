import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImovelController } from './imovel.controller';
import { BatchCreateImoveis } from './use-cases/batch-create-imoveis';
import { BuscarChavesExistentes } from './use-cases/buscar-chaves-existentes';
import { CalcularScore } from './use-cases/calcular-score';
import { CountPrioridadeDrone } from './use-cases/count-prioridade-drone';
import { CreateImovel } from './use-cases/create-imovel';
import { DeleteImovel } from './use-cases/delete-imovel';
import { FindByEndereco } from './use-cases/find-by-endereco';
import { FilterImovel } from './use-cases/filter-imovel';
import { GetImovel } from './use-cases/get-imovel';
import { GetImovelResumo } from './use-cases/get-imovel-resumo';
import { ListImovelProblematicos } from './use-cases/list-imovel-problematicos';
import { ListImovelResumo } from './use-cases/list-imovel-resumo';
import { PaginationImovel } from './use-cases/pagination-imovel';
import { SaveImovel } from './use-cases/save-imovel';

@Module({
  providers: [
    CreateImovel,
    DeleteImovel,
    FilterImovel,
    GetImovel,
    PaginationImovel,
    SaveImovel,
    CalcularScore,
    ListImovelResumo,
    GetImovelResumo,
    ListImovelProblematicos,
    FindByEndereco,
    BuscarChavesExistentes,
    CountPrioridadeDrone,
    BatchCreateImoveis,
    JwtService,
    PrismaService,
  ],
  controllers: [ImovelController],
  exports: [CalcularScore],
  imports: [DatabaseModule],
})
export class ImovelModule {}
