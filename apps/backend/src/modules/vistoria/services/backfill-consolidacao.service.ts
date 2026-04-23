import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ConsolidarVistoria } from '../use-cases/consolidar-vistoria';

export interface BackfillResult {
  total: number;
  processadas: number;
  ok: number;
  erros: number;
  duracaoMs: number;
  errosDetalhe: Array<{ vistoriaId: string; erro: string }>;
}

@Injectable()
export class BackfillConsolidacaoService {
  private readonly logger = new Logger(BackfillConsolidacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consolidarVistoria: ConsolidarVistoria,
  ) {}

  async executar(opts?: {
    loteSize?: number;
    limite?: number;
    dryRun?: boolean;
  }): Promise<BackfillResult> {
    const loteSize = Math.min(Math.max(opts?.loteSize ?? 200, 1), 1000);
    const limite = opts?.limite;
    const dryRun = opts?.dryRun ?? false;

    this.logger.log(
      `[Backfill] Iniciado. loteSize=${loteSize}, limite=${limite ?? 'sem limite'}, dryRun=${dryRun}`,
    );

    const total = await this.prisma.client.vistorias.count({
      where: { consolidado_em: null, deleted_at: null },
    });

    if (dryRun) {
      this.logger.log(`[Backfill] dryRun=true — ${total} candidatas encontradas, nenhuma processada.`);
      return { total, processadas: 0, ok: 0, erros: 0, duracaoMs: 0, errosDetalhe: [] };
    }

    const startTs = Date.now();
    let ok = 0;
    let erros = 0;
    let processadas = 0;
    const errosDetalhe: Array<{ vistoriaId: string; erro: string }> = [];

    while (true) {
      // skip: 0 sempre — vistorias consolidadas saem do filtro a cada iteração
      const candidatas = await this.prisma.client.vistorias.findMany({
        where: { consolidado_em: null, deleted_at: null },
        select: { id: true },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: loteSize,
      });

      if (candidatas.length === 0) break;

      const okAntes = ok;
      for (const { id } of candidatas) {
        try {
          await this.consolidarVistoria.execute({ vistoriaId: id, motivo: 'backfill' });
          ok++;
        } catch (err) {
          erros++;
          const mensagem = err instanceof Error ? err.message : String(err);
          errosDetalhe.push({ vistoriaId: id, erro: mensagem });
          this.logger.warn(`[Backfill] Falha em vistoria ${id}: ${mensagem}`);
        }
        processadas++;
      }

      this.logger.log(
        `[Backfill] Lote concluído: ${ok} ok, ${erros} erros | acumulado: ${processadas}/${total}`,
      );

      // Safeguard: lote inteiro falhou → interrompe para evitar loop infinito
      // (se ninguém consolida, candidatas não sai do filtro e voltaríamos às mesmas linhas)
      if (ok === okAntes && candidatas.length > 0) {
        this.logger.error(
          `[Backfill] Interrompido: lote de ${candidatas.length} vistorias falhou integralmente. ` +
          `Verifique ConsolidarVistoria antes de re-executar.`,
        );
        break;
      }

      if (candidatas.length < loteSize) break;
      if (limite != null && processadas >= limite) break;
    }

    const duracaoMs = Date.now() - startTs;
    this.logger.log(`[Backfill] Concluído em ${duracaoMs}ms: ${ok} ok, ${erros} erros.`);

    return { total, processadas, ok, erros, duracaoMs, errosDetalhe };
  }

  // Cron mensal de segurança — habilitado apenas via env flag
  @Cron('0 4 1 * *')
  async cronBackfillMensal(): Promise<void> {
    if (process.env.BACKFILL_CONSOLIDACAO_ENABLED !== 'true') {
      return;
    }
    this.logger.log('[Backfill] Cron mensal iniciado');
    await this.executar({ loteSize: 200 });
  }
}
