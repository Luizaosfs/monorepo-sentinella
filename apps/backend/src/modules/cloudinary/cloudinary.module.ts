import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';

@Module({
  providers: [CloudinaryService, JwtService, PrismaService],
  exports: [CloudinaryService],
  controllers: [CloudinaryController],
  imports: [DatabaseModule],
})
export class CloudinaryModule {}
