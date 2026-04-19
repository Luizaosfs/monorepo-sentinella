import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DroneException } from '../errors/drone.exception';

@Injectable()
export class GetDroneRiskConfig {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const config = await this.prisma.client.sentinela_drone_risk_config.findFirst({
      where: { cliente_id: clienteId },
    });
    if (!config) throw DroneException.riskConfigNotFound();
    return config;
  }
}
