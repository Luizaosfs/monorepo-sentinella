import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CriarFocoDeVistoriaDeposito } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-vistoria-deposito';

import { AddDepositoInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class AddDeposito {
  private readonly logger = new Logger(AddDeposito.name);

  constructor(
    private prisma: PrismaService,
    private criarFocoDeVistoriaDeposito: CriarFocoDeVistoriaDeposito,
    private consolidarVistoria: ConsolidarVistoria,
  ) {}

  async execute(vistoriaId: string, clienteId: string, data: AddDepositoInput) {
    const vistoria = await this.prisma.client.vistorias.findFirst({
      where: { id: vistoriaId, cliente_id: clienteId, deleted_at: null },
      select: { id: true },
    });
    if (!vistoria) throw VistoriaException.notFound();

    const deposito = await this.prisma.client.vistoria_depositos.create({
      data: {
        vistoria_id:       vistoriaId,
        cliente_id:        clienteId,
        tipo:              data.tipo,
        qtd_inspecionados: data.qtdInspecionados,
        qtd_com_focos:     data.qtdComFocos,
        qtd_eliminados:    data.qtdEliminados,
        usou_larvicida:    data.usouLarvicida,
        qtd_larvicida_g:   data.qtdLarvicidaG ?? null,
        qtd_com_agua:      data.qtdComAgua,
        eliminado:         data.eliminado,
        vedado:            data.vedado,
        ia_identificacao:  (data.iaIdentificacao ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    try {
      await this.criarFocoDeVistoriaDeposito.execute({
        vistoriaId,
        qtdComFocos: data.qtdComFocos,
      });
    } catch (err) {
      this.logger.error(
        `Hook CriarFocoDeVistoriaDeposito falhou: vistoria=${vistoriaId} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      await this.consolidarVistoria.execute({
        vistoriaId,
        motivo: 'automático — INSERT em vistoria_depositos',
      });
    } catch (err) {
      this.logger.error(
        `Hook ConsolidarVistoria falhou: vistoriaId=${vistoriaId} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { deposito };
  }
}
