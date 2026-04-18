import { Body, Controller, Get, Post, Req, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { Request } from 'express';

import { Public } from '@/decorators/roles.decorator';

import { LoginBody, loginSchema } from './dtos/login.body';
import { RefreshBody, refreshSchema } from './dtos/refresh.body';
import { LoginUseCase } from './use-cases/login.use-case';
import { MeUseCase } from './use-cases/me.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';

@UsePipes(MyZodValidationPipe)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private refreshTokenUseCase: RefreshTokenUseCase,
    private meUseCase: MeUseCase,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário (email + senha)' })
  async login(@Body() body: LoginBody) {
    const parsed = loginSchema.parse(body);
    return this.loginUseCase.execute(parsed);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar token JWT' })
  async refresh(@Body() body: RefreshBody) {
    const parsed = refreshSchema.parse(body);
    return this.refreshTokenUseCase.execute(parsed);
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna usuário autenticado' })
  async me(@Req() req: Request) {
    return this.meUseCase.execute(req['user'] as AuthenticatedUser);
  }
}
