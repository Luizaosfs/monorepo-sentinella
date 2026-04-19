import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DroneException } from '../errors/drone.exception';
import { UpdateDroneRiskConfigInput } from '../dtos/drone-yolo.body';

@Injectable()
export class UpdateDroneRiskConfig {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: UpdateDroneRiskConfigInput): Promise<void> {
    const existing = await this.prisma.client.sentinela_drone_risk_config.findFirst({
      where:  { cliente_id: clienteId },
      select: { id: true },
    });
    if (!existing) throw DroneException.riskConfigNotFound();

    await this.prisma.client.sentinela_drone_risk_config.update({
      where: { id: existing.id },
      data: {
        ...(input.baseByRisco          && { base_by_risco:          input.baseByRisco }),
        ...(input.priorityThresholds   && { priority_thresholds:    input.priorityThresholds }),
        ...(input.slaByPriorityHours   && { sla_by_priority_hours:  input.slaByPriorityHours }),
        ...(input.confidenceMultiplier != null && { confidence_multiplier: input.confidenceMultiplier }),
        ...(input.itemOverrides        && { item_overrides: input.itemOverrides as Prisma.InputJsonValue }),
        updated_at: new Date(),
      },
    });
  }
}
