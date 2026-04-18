import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { env } from 'src/lib/env/server';

import { AuthController } from './auth.controller';
import { LoginUseCase } from './use-cases/login.use-case';
import { MeUseCase } from './use-cases/me.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      global: true,
      secret: env.SECRET_JWT,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN as any },
    }),
  ],
  controllers: [AuthController],
  providers: [LoginUseCase, RefreshTokenUseCase, MeUseCase, PrismaService],
})
export class AuthModule {}
