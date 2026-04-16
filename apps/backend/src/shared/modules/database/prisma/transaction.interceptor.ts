import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';

import { PrismaContext } from './prisma.context';
import { PrismaService } from './prisma.service';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private prismaContext: PrismaContext,
    @Inject(REQUEST) private request: Request,
  ) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    return from(this.handleWithTransaction(next));
  }

  private async handleWithTransaction(next: CallHandler<any>): Promise<any> {
    return this.prisma.client.$transaction(
      async (tx) => {
        this.prismaContext.setTransaction(tx);
        try {
          const observable = next.handle();
          return await lastValueFrom(observable);
        } finally {
          this.prismaContext.clearTransaction();
        }
      },
      { timeout: 150000 },
    );
  }
}
