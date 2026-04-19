import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { AddSynonymInput } from '../dtos/drone-yolo.body';

@Injectable()
export class AddSynonym {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: AddSynonymInput) {
    const synonym = await this.prisma.client.sentinela_yolo_synonym.create({
      data: {
        cliente_id: clienteId,
        synonym:    input.synonym,
        maps_to:    input.mapsTo,
      },
    });
    return synonym;
  }
}
