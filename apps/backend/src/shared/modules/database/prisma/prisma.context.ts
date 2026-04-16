import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaContext {
  constructor(
    private cls: ClsService,
    private prisma: PrismaService,
  ) {}

  setTransaction(tx: Prisma.TransactionClient) {
    this.cls.set('prismaTx', tx);
  }

  clearTransaction() {
    this.cls.set('prismaTx', null);
  }

  getTransaction(): Prisma.TransactionClient | null {
    return this.cls.get('prismaTx');
  }

  get client(): Prisma.TransactionClient | PrismaClient {
    const tx = this.getTransaction();
    return tx ?? this.prisma.client;
  }

  async executeInTransaction<T>(
    operation: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = this.client;
    return operation(client as Prisma.TransactionClient);
  }
}
