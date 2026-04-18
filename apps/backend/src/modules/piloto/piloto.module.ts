import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PilotoController } from './piloto.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PilotoController],
  providers: [JwtService, PrismaService],
})
export class PilotoModule {}
