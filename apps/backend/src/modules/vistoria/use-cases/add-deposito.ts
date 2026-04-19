import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { AddDepositoInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';

@Injectable()
export class AddDeposito {
  constructor(private prisma: PrismaService) {}

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
    return { deposito };
  }
}
