import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CicloController } from './ciclo.controller';
import { AbrirCiclo } from './use-cases/abrir-ciclo';
import { AtivarCiclo } from './use-cases/ativar-ciclo';
import { CreateCiclo } from './use-cases/create-ciclo';
import { FecharCiclo } from './use-cases/fechar-ciclo';
import { FilterCiclo } from './use-cases/filter-ciclo';
import { GetCicloAtivo } from './use-cases/get-ciclo-ativo';
import { GetCicloProgresso } from './use-cases/get-ciclo-progresso';
import { SaveCiclo } from './use-cases/save-ciclo';

@Module({
  providers: [
    AbrirCiclo,
    AtivarCiclo,
    CreateCiclo,
    FecharCiclo,
    FilterCiclo,
    GetCicloAtivo,
    GetCicloProgresso,
    SaveCiclo,
    JwtService,
    PrismaService,
  ],
  controllers: [CicloController],
  imports: [DatabaseModule],
})
export class CicloModule {}
