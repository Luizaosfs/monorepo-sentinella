import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type {
  ExtendedPrismaClient,
  ExtendedTransactionClient,
} from './extensions/updated-at.extension';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaContext {
  constructor(
    private cls: ClsService,
    private prisma: PrismaService,
  ) {}

  setTransaction(tx: ExtendedTransactionClient) {
    this.cls.set('prismaTx', tx);
  }

  clearTransaction() {
    this.cls.set('prismaTx', null);
  }

  getTransaction(): ExtendedTransactionClient | null {
    return this.cls.get('prismaTx');
  }

  get client(): ExtendedTransactionClient | ExtendedPrismaClient {
    const tx = this.getTransaction();
    return tx ?? this.prisma.client;
  }

  async executeInTransaction<T>(
    operation: (client: ExtendedTransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = this.client;
    return operation(client as ExtendedTransactionClient);
  }
}
