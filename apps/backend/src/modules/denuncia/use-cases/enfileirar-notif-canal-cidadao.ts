import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface EnfileirarNotifCanalCidadaoInput {
  focoId: string;
  clienteId: string;
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  suspeitaEm: Date;
  origemLevantamentoItemId?: string | null;
}

/**
 * Port TS de `fn_notificar_foco_cidadao` (AFTER INSERT trigger legado).
 * Enfileira job `notif_canal_cidadao` no `job_queue` para a Edge Function consumir.
 *
 * O caller é responsável pelo wrapping best-effort (try/catch + log).
 * Se `tx` for fornecido, usa o cliente transacional; caso contrário, prisma.client.
 */
@Injectable()
export class EnfileirarNotifCanalCidadao {
  constructor(private prisma: PrismaService) {}

  async execute(
    input: EnfileirarNotifCanalCidadaoInput,
    tx?: unknown,
  ): Promise<{ jobId: string }> {
    const client =
      (tx as typeof this.prisma.client | undefined) ?? this.prisma.client;

    const job = await client.job_queue.create({
      data: {
        tipo: 'notif_canal_cidadao',
        status: 'pendente',
        payload: {
          foco_id: input.focoId,
          cliente_id: input.clienteId,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          endereco: input.endereco ?? null,
          suspeita_em: input.suspeitaEm.toISOString(),
          origem_item_id: input.origemLevantamentoItemId ?? null,
        },
      },
      select: { id: true },
    });

    return { jobId: job.id };
  }
}
