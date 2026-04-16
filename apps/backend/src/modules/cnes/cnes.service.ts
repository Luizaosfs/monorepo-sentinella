import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

interface CnesEstabelecimento {
  co_cnes: string;
  no_fantasia: string;
  no_logradouro?: string;
  nu_endereco?: string;
  no_bairro?: string;
  nu_latitude?: string;
  nu_longitude?: string;
  nu_telefone?: string;
  tp_unidade?: string;
}

@Injectable()
export class CnesService {
  private readonly logger = new Logger(CnesService.name);

  constructor(private prisma: PrismaService) {}

  async sync(clienteId?: string): Promise<{ clientes: number; upserts: number }> {
    const where = clienteId
      ? { id: clienteId, deleted_at: null }
      : { deleted_at: null, ibge_municipio: { not: null } };

    const clientes = await this.prisma.client.clientes.findMany({
      where: where as any,
      select: { id: true, ibge_municipio: true },
    });

    let totalUpserts = 0;

    for (const cliente of clientes) {
      if (!cliente.ibge_municipio) continue;

      try {
        const url = `https://cnes.datasus.gov.br/services/estabelecimentos?municipio=${cliente.ibge_municipio}&limit=500`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          this.logger.warn(`[CnesService.sync] CNES API retornou ${res.status} para municipio=${cliente.ibge_municipio}`);
          continue;
        }

        const dados = (await res.json()) as CnesEstabelecimento[];
        if (!Array.isArray(dados)) continue;

        for (const est of dados) {
          try {
            await this.prisma.client.unidades_saude.upsert({
              where: { cnes: est.co_cnes },
              create: {
                cliente_id: cliente.id,
                cnes: est.co_cnes,
                nome: est.no_fantasia,
                tipo: est.tp_unidade ?? 'ubs',
                endereco: [est.no_logradouro, est.nu_endereco].filter(Boolean).join(', ') || null,
                bairro: est.no_bairro ?? null,
                latitude: est.nu_latitude ? parseFloat(est.nu_latitude) : null,
                longitude: est.nu_longitude ? parseFloat(est.nu_longitude) : null,
                telefone: est.nu_telefone ?? null,
                origem: 'cnes',
                ativo: true,
              },
              update: {
                nome: est.no_fantasia,
                endereco: [est.no_logradouro, est.nu_endereco].filter(Boolean).join(', ') || null,
                bairro: est.no_bairro ?? null,
                latitude: est.nu_latitude ? parseFloat(est.nu_latitude) : null,
                longitude: est.nu_longitude ? parseFloat(est.nu_longitude) : null,
                telefone: est.nu_telefone ?? null,
                updated_at: new Date(),
              },
            });
            totalUpserts++;
          } catch (err: any) {
            this.logger.warn(`[sync] Falha upsert CNES ${est.co_cnes}: ${err?.message}`);
          }
        }

        await this.prisma.client.clientes.update({
          where: { id: cliente.id },
          data: { ultima_sync_cnes_em: new Date() } as any,
        });
      } catch (err: any) {
        this.logger.warn(`[CnesService.sync] Falha cliente ${cliente.id}: ${err?.message}`);
      }
    }

    this.logger.log(
      `[CnesService.sync] clientes=${clientes.length} upserts=${totalUpserts}`,
    );
    return { clientes: clientes.length, upserts: totalUpserts };
  }
}
