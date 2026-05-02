import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { AddRiscosInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class AddRiscos {
  private readonly logger = new Logger(AddRiscos.name);

  constructor(
    private prisma: PrismaService,
    private consolidarVistoria: ConsolidarVistoria,
  ) {}

  async execute(clienteId: string, data: AddRiscosInput) {
    const vistoria = await this.prisma.client.vistorias.findFirst({
      where: { id: data.vistoriaId, cliente_id: clienteId, deleted_at: null },
      select: { id: true },
    });
    if (!vistoria) throw VistoriaException.notFound();

    const risco = await this.prisma.client.vistoria_riscos.create({
      data: {
        vistoria_id:               data.vistoriaId,
        cliente_id:                clienteId,
        menor_incapaz:             data.menorIncapaz,
        idoso_incapaz:             data.idosoIncapaz,
        mobilidade_reduzida:       data.mobilidadeReduzida,
        acamado:                   data.acamado,
        dep_quimico:               data.depQuimico,
        risco_alimentar:           data.riscoAlimentar,
        risco_moradia:             data.riscoMoradia,
        criadouro_animais:         data.criadouroAnimais,
        lixo:                      data.lixo,
        residuos_organicos:        data.residuosOrganicos,
        residuos_quimicos:         data.residuosQuimicos,
        residuos_medicos:          data.residuosMedicos,
        acumulo_material_organico: data.acumuloMaterialOrganico,
        animais_sinais_lv:         data.animaisSinaisLv,
        caixa_destampada:          data.caixaDestampada,
        outro_risco_vetorial:      data.outroRiscoVetorial ?? null,
      },
    });

    try {
      await this.consolidarVistoria.execute({
        vistoriaId: data.vistoriaId,
        motivo: 'automático — INSERT em vistoria_riscos',
      });
    } catch (err) {
      this.logger.error(
        `Hook ConsolidarVistoria falhou: vistoriaId=${data.vistoriaId} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { risco };
  }
}
