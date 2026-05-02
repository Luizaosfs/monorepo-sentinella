import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AddSintomasInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class AddSintomas {
  private readonly logger = new Logger(AddSintomas.name);

  constructor(
    private prisma: PrismaService,
    private consolidarVistoria: ConsolidarVistoria,
  ) {}

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
        nausea:                 data.nausea,
        moradores_sintomas_qtd: data.moradoresSintomasQtd,
      },
    });

    try {
      await this.consolidarVistoria.execute({
        vistoriaId: data.vistoriaId,
        motivo: 'automático — INSERT em vistoria_sintomas',
      });
    } catch (err) {
      this.logger.error(
        `Hook ConsolidarVistoria falhou: vistoriaId=${data.vistoriaId} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { sintoma };
  }
}
