import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Public } from '@/decorators/roles.decorator';

import { LoginBody, loginSchema } from './dtos/login.body';
import { RefreshBody, refreshSchema } from './dtos/refresh.body';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';

@UsePipes(MyZodValidationPipe)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private refreshTokenUseCase: RefreshTokenUseCase,
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
}
