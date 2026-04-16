import { Module } from '@nestjs/common';

import { PrismaContext } from './prisma/prisma.context';
import { PrismaService } from './prisma/prisma.service';
import { RepositoryModule } from './repository.module';

@Module({
  imports: [RepositoryModule.forRoot()],
  providers: [PrismaService, PrismaContext],
  exports: [PrismaService, PrismaContext, RepositoryModule],
})
export class DatabaseModule {}
