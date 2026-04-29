import { Injectable } from '@nestjs/common';
import {
  Drone,
  PipelineRun,
  Voo,
} from 'src/modules/drone/entities/drone';
import { DroneReadRepository } from 'src/modules/drone/repositories/drone-read.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaDroneMapper } from '../../mappers/prisma-drone.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(DroneReadRepository)
@Injectable()
export class PrismaDroneReadRepository implements DroneReadRepository {
  constructor(private prisma: PrismaService) {}

  async findDrones(clienteId: string): Promise<Drone[]> {
    const rows = await this.prisma.client.drones.findMany({
      where: { cliente_id: clienteId, ativo: true },
      orderBy: { nome: 'asc' },
    });
    return rows.map((r) => PrismaDroneMapper.toDomain(r as any));
  }

  async findDroneById(id: string): Promise<Drone | null> {
    const row = await this.prisma.client.drones.findFirst({
      where: { id, ativo: true },
    });
    return row ? PrismaDroneMapper.toDomain(row as any) : null;
  }

  async findVoos(clienteId: string): Promise<Voo[]> {
    const rows = await this.prisma.client.voos.findMany({
      where: { planejamento: { cliente_id: clienteId } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaDroneMapper.vooToDomain(r as any));
  }

  async findVooById(id: string): Promise<Voo | null> {
    const row = await this.prisma.client.voos.findUnique({
      where: { id },
    });
    return row ? PrismaDroneMapper.vooToDomain(row as any) : null;
  }

  async findPipelines(clienteId: string): Promise<PipelineRun[]> {
    const rows = await this.prisma.client.pipeline_runs.findMany({
      where: { cliente_id: clienteId },
      orderBy: { iniciado_em: 'desc' },
    });
    return rows.map((r) => PrismaDroneMapper.pipelineToDomain(r as any));
  }

  async findPipelineById(id: string): Promise<PipelineRun | null> {
    const row = await this.prisma.client.pipeline_runs.findUnique({
      where: { id },
    });
    return row ? PrismaDroneMapper.pipelineToDomain(row as any) : null;
  }
}
