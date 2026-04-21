import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';

import { buildAuditLogExtension } from './extensions/audit-log.extension';
import { createdByExtension } from './extensions/created-by.extension';
import {
  applyUpdatedAtExtension,
  type ExtendedPrismaClient,
} from './extensions/updated-at.extension';

function buildPoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = { connectionString };

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return config;
  }

  const host = url.hostname;
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (isLoopback) {
    return config;
  }

  const sslMode = url.searchParams.get('sslmode');
  const wantsSslExplicit =
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full';
  const refusesSsl = sslMode === 'disable';

  const isSupabase =
    host.endsWith('.supabase.co') || host.endsWith('.supabase.com');
  const forceSsl = process.env.DATABASE_SSL === 'true';

  if (refusesSsl) {
    return config;
  }

  if (wantsSslExplicit || isSupabase || forceSsl) {
    // Supabase / Postgres na nuvem: TLS obrigatório; rejectUnauthorized:false evita falha com CAs do pooler.
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  /**
   * Cliente estendido (com extensions aplicadas — atualmente: updated-at).
   * É ESTE que deve ser consumido pelo resto da aplicação via `get client()`.
   * O cliente original `this.prisma` é mantido para `$connect`/`$disconnect`,
   * que não estão disponíveis no tipo estendido.
   */
  private extendedPrisma!: ExtendedPrismaClient;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to initialize PrismaClient.');
    }

    const pool = new Pool(buildPoolConfig(databaseUrl));

    this.prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });

    this.extendedPrisma = applyUpdatedAtExtension(this.prisma)
      .$extends(createdByExtension)
      .$extends(buildAuditLogExtension(this.prisma));
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  /**
   * Sentinella usa schema público único com isolamento via cliente_id (WHERE).
   * Diferente do ManFrota que usa multi-schema.
   * O setSchema é mantido por compatibilidade mas não troca schema.
   */
  async setSchema(_subdomain: string) {
    // No-op: Sentinella usa single-schema com row-level filtering via cliente_id
    // Mantido para compatibilidade com PrismaInterceptor/TransactionInterceptor
  }

  get client() {
    return this.extendedPrisma;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
