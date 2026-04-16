import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Injectable()
export class PrismaInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      finalize(async () => {
        // Sentinella usa connection pool singleton, não precisa disconnect por request
      }),
      catchError(async (err) => {
        console.error('❌ Erro na requisição:', err);
        throw err;
      }),
    );
  }
}
