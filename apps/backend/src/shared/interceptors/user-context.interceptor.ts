import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

/**
 * Chave CLS onde guardamos o ID do usuário logado durante o ciclo da request.
 *
 * Lida pelo `createdByExtension` para popular `created_by` / `alterado_por` /
 * `updated_by` automaticamente em INSERT/UPDATE das 6 tabelas LGPD.
 *
 * ⚠️ Não acessar diretamente — use o helper `getCurrentUserId()` exportado
 * junto com a extension (arquivo `created-by.extension.ts`).
 */
export const CLS_USER_ID_KEY = 'sentinella:userId';

/**
 * Interceptor que propaga `request.user.id` (populado pelo `AuthGuard`)
 * para o `ClsService`. Roda APÓS o `AuthGuard`, portanto `request.user`
 * já existe — exceto em rotas `@Public()`, onde ele não existe e nada
 * é setado (NULL silencioso — igual ao comportamento `auth.uid()` do
 * Supabase legado sem JWT).
 *
 * Registrado globalmente via `APP_INTERCEPTOR` em `app.module.ts`.
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const userId = request?.user?.id;
    if (userId) {
      this.cls.set(CLS_USER_ID_KEY, userId);
    }
    // Intencionalmente NÃO seta nada se não há user — rotas @Public e contextos
    // fora de request (crons, seeds) geram NULL silencioso no extension.

    return next.handle();
  }
}
