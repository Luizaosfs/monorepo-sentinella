import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetYoloFeedbackByItem {
  constructor(private prisma: PrismaService) {}

  async execute(levantamentoItemId: string, clienteId: string) {
    const feedback = await this.prisma.client.yolo_feedback.findFirst({
      where: { levantamento_item_id: levantamentoItemId, cliente_id: clienteId },
    });
    return { feedback };
  }
}
