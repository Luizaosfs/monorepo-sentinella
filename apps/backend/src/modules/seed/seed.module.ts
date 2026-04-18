import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeedController],
  providers: [SeedService, JwtService, PrismaService],
})
export class SeedModule {}
