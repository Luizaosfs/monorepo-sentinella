import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { AddSintomasInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';

@Injectable()
export class AddSintomas {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, data: AddSintomasInput) {
    const vistoria = await this.prisma.client.vistorias.findFirst({
      where: { id: data.vistoriaId, cliente_id: clienteId, deleted_at: null },
      select: { id: true },
    });
    if (!vistoria) throw VistoriaException.notFound();

    const sintoma = await this.prisma.client.vistoria_sintomas.create({
      data: {
        vistoria_id:            data.vistoriaId,
        cliente_id:             clienteId,
        febre:                  data.febre,
        manchas_vermelhas:      data.manchasVermelhas,
        dor_articulacoes:       data.dorArticulacoes,
        dor_cabeca:             data.dorCabeca,
        moradores_sintomas_qtd: data.moradoresSintomasQtd,
      },
    });
    return { sintoma };
  }
}
