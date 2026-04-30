import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { Request, Response } from 'express';

import { Public, SkipTenant } from '@/decorators/roles.decorator';

import { ChangePasswordBody, changePasswordSchema } from './dtos/change-password.body';
import { ForgotPasswordBody, forgotPasswordSchema } from './dtos/forgot-password.body';
import { LoginBody, loginSchema } from './dtos/login.body';
import { ResetPasswordBody, resetPasswordSchema } from './dtos/reset-password.body';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { ForgotPasswordUseCase } from './use-cases/forgot-password.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { MeUseCase } from './use-cases/me.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';

const REFRESH_COOKIE = 'refresh_token';
// 30 dias em ms — deve coincidir com REFRESH_TOKEN_EXPIRES_IN
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

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

  /** Opções do cookie do refresh_token. path: '/auth' limita o envio automático
   *  apenas para os endpoints de autenticação — não polui requests operacionais. */
  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário (email + senha)' })
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = loginSchema.parse(body);
    const { accessToken, refreshToken, user } = await this.loginUseCase.execute(parsed);
    res.cookie(REFRESH_COOKIE, refreshToken, this.refreshCookieOptions());
    // refreshToken não é retornado no body — viaja apenas via cookie httpOnly
    return { accessToken, user };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token via cookie httpOnly' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    const { accessToken, refreshToken: newRefreshToken, user } =
      await this.refreshTokenUseCase.execute({ refreshToken });
    res.cookie(REFRESH_COOKIE, newRefreshToken, this.refreshCookieOptions());
    return { accessToken, user };
  }

  @SkipTenant()
  @Post('logout')
  @ApiOperation({ summary: 'Revogar refresh token e limpar cookie (logout)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (refreshToken) {
      await this.logoutUseCase.execute(refreshToken);
    }
    // Limpa o cookie com o mesmo path em que foi criado
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { ok: true };
  }

  @SkipTenant()
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

  @SkipTenant()
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
