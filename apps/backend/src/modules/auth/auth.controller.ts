import { Body, Controller, Get, Post, Req, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { Request } from 'express';

import { Public } from '@/decorators/roles.decorator';

import { ChangePasswordBody, changePasswordSchema } from './dtos/change-password.body';
import { ForgotPasswordBody, forgotPasswordSchema } from './dtos/forgot-password.body';
import { LoginBody, loginSchema } from './dtos/login.body';
import { RefreshBody, refreshSchema } from './dtos/refresh.body';
import { ResetPasswordBody, resetPasswordSchema } from './dtos/reset-password.body';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { ForgotPasswordUseCase } from './use-cases/forgot-password.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { MeUseCase } from './use-cases/me.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';

@UsePipes(MyZodValidationPipe)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private loginUseCase: LoginUseCase,
    private refreshTokenUseCase: RefreshTokenUseCase,
    private logoutUseCase: LogoutUseCase,
    private meUseCase: MeUseCase,
    private forgotPasswordUseCase: ForgotPasswordUseCase,
    private changePasswordUseCase: ChangePasswordUseCase,
    private resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário (email + senha)' })
  async login(@Body() body: LoginBody) {
    const parsed = loginSchema.parse(body);
    return this.loginUseCase.execute(parsed);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar token JWT' })
  async refresh(@Body() body: RefreshBody) {
    const parsed = refreshSchema.parse(body);
    return this.refreshTokenUseCase.execute(parsed);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revogar refresh token (logout)' })
  async logout(@Body() body: RefreshBody) {
    const parsed = refreshSchema.parse(body);
    return this.logoutUseCase.execute(parsed.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna usuário autenticado' })
  async me(@Req() req: Request) {
    return this.meUseCase.execute(req['user'] as AuthenticatedUser);
  }

  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar email de recuperação de senha' })
  async forgotPassword(@Body() body: ForgotPasswordBody) {
    const parsed = forgotPasswordSchema.parse(body);
    return this.forgotPasswordUseCase.execute(parsed);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Alterar senha (usuário autenticado, sabe a senha atual)' })
  async changePassword(@Body() body: ChangePasswordBody, @Req() req: Request) {
    const parsed = changePasswordSchema.parse(body);
    return this.changePasswordUseCase.execute(req['user'] as AuthenticatedUser, parsed);
  }

  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha via token de recovery (link do email)' })
  async resetPassword(@Body() body: ResetPasswordBody) {
    const parsed = resetPasswordSchema.parse(body);
    return this.resetPasswordUseCase.execute(parsed);
  }
}
