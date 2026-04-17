import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Injectable()
export class PrismaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PrismaInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      finalize(async () => {
        // Sentinella usa connection pool singleton, não precisa disconnect por request
      }),
      catchError(async (err) => {
        const req = context.switchToHttp().getRequest();
        this.logger.error(
          `Erro na requisição ${req.method} ${req.url}: ${(err as Error).message}`,
          (err as Error).stack,
        );
        throw err;
      }),
    );
  }
}
