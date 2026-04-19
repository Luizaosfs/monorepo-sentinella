import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { AddRiscosInput } from '../dtos/add-vistoria-child.body';
import { VistoriaException } from '../errors/vistoria.exception';

@Injectable()
export class AddRiscos {
  constructor(private prisma: PrismaService) {}

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
    return { risco };
  }
}
