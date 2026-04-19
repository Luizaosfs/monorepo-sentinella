import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { BulkCreateVoosInput } from '../dtos/drone-yolo.body';

const CHUNK = 50;

@Injectable()
export class BulkCreateVoos {
  constructor(private prisma: PrismaService) {}

  async execute(input: BulkCreateVoosInput): Promise<{ importados: number }> {
    let importados = 0;
    for (let i = 0; i < input.rows.length; i += CHUNK) {
      const chunk = input.rows.slice(i, i + CHUNK);
      const result = await this.prisma.client.voos.createMany({
        data: chunk.map(r => ({
          inicio:            r.inicio,
          fim:               r.fim ?? null,
          planejamento_id:   r.planejamentoId ?? null,
          piloto_id:         r.pilotoId ?? null,
          voo_numero:        r.vooNumero ?? null,
          duracao_min:       r.duracaoMin ?? null,
          km:                r.km ?? null,
          ha:                r.ha ?? null,
          baterias:          r.baterias ?? null,
          fotos:             r.fotos ?? null,
          amostra_lat:       r.amostLat ?? null,
          amostra_lon:       r.amostLon ?? null,
          amostra_data_hora: r.amostDataHora ?? null,
          amostra_arquivo:   r.amostArquivo ?? null,
        })),
        skipDuplicates: true,
      });
      importados += result.count;
    }
    return { importados };
  }
}
