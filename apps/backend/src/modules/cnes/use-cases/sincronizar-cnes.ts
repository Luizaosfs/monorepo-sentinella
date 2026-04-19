import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { CnesService } from '../cnes.service';

const RETENTION_DAYS = 30;

@Injectable()
export class SincronizarCnes {
  private readonly logger = new Logger(SincronizarCnes.name);

  constructor(
    private prisma: PrismaService,
    private cnesService: CnesService,
  ) {}

  async execute(clienteId: string) {
    const retentionUntil = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const controle = await this.prisma.client.unidades_saude_sync_controle.create({
      data: {
        cliente_id:       clienteId,
        status:           'em_andamento',
        origem_execucao:  'manual',
        retention_until:  retentionUntil,
      },
    });

    try {
      const resultado = await this.cnesService.sync(clienteId);

      await this.prisma.client.unidades_saude_sync_controle.update({
        where: { id: controle.id },
        data: {
          status:            'concluido',
          finalizado_em:     new Date(),
          total_recebidos:   resultado.upserts,
          total_inseridos:   resultado.upserts,
          total_atualizados: 0,
          total_inativados:  0,
        },
      });

      return { controle_id: controle.id, status: 'concluido', ...resultado };
    } catch (err: unknown) {
      const e = err as { message?: string };
      this.logger.error(`[SincronizarCnes] Falha cliente=${clienteId}: ${e?.message}`);

      await this.prisma.client.unidades_saude_sync_controle.update({
        where: { id: controle.id },
        data: {
          status:        'erro',
          finalizado_em: new Date(),
          erro_mensagem: e?.message ?? 'Erro desconhecido',
        },
      });

      throw err;
    }
  }
}
