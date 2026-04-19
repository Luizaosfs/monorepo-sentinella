import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { FinalizarImportInput } from '../dtos/finalizar-import.body';

@Injectable()
export class FinalizarImport {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string, input: FinalizarImportInput) {
    const existing = await this.prisma.client.import_log.findFirst({
      where: { id },
      select: { id: true, cliente_id: true },
    });

    if (!existing) throw new NotFoundException('Log de importação não encontrado');
    if (existing.cliente_id !== clienteId) throw new ForbiddenException('Recurso não pertence ao tenant');

    return this.prisma.client.import_log.update({
      where: { id },
      data: {
        ...(input.importados     !== undefined && { importados:     input.importados }),
        ...(input.comErro        !== undefined && { com_erro:       input.comErro }),
        ...(input.ignorados      !== undefined && { ignorados:      input.ignorados }),
        ...(input.duplicados     !== undefined && { duplicados:     input.duplicados }),
        ...(input.geocodificados !== undefined && { geocodificados: input.geocodificados }),
        ...(input.geoFalhou      !== undefined && { geo_falhou:     input.geoFalhou }),
        ...(input.erros          !== undefined && { erros:          input.erros as Prisma.InputJsonValue }),
        status:      input.status ?? 'concluido',
        finished_at: new Date(),
      },
    });
  }
}
