import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { SeedClienteNovoResult } from './seed-cliente-novo';
import { SeedClienteNovo } from './seed-cliente-novo';

interface RetroativoResult {
  totalClientes: number;
  seeded: number;
  skipped: number;
  detalhes: Array<{ clienteId: string; resultado: SeedClienteNovoResult }>;
}

@Injectable()
export class SeedSlaFocoConfigRetroativo {
  private readonly logger = new Logger(SeedSlaFocoConfigRetroativo.name);

  constructor(
    private prisma: PrismaService,
    private seedClienteNovo: SeedClienteNovo,
  ) {}

  async execute(clienteId?: string): Promise<RetroativoResult> {
    const clientes = clienteId
      ? await this.prisma.client.clientes.findMany({
          where: { id: clienteId, deleted_at: null },
          select: { id: true },
        })
      : await this.prisma.client.clientes.findMany({
          where: { deleted_at: null },
          select: { id: true },
        });

    const detalhes: RetroativoResult['detalhes'] = [];
    let seeded = 0;

    for (const c of clientes) {
      try {
        const resultado = await this.seedClienteNovo.executeRetroativo(c.id);
        detalhes.push({ clienteId: c.id, resultado });
        seeded++;
        this.logger.log(`Seed retroativo OK para cliente ${c.id}`);
      } catch (err) {
        this.logger.error(`Seed retroativo FALHOU para cliente ${c.id}: ${(err as Error).message}`);
      }
    }

    return {
      totalClientes: clientes.length,
      seeded,
      skipped: clientes.length - seeded,
      detalhes,
    };
  }
}
