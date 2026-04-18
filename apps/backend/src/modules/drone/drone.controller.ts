import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateDroneBody,
  CreateVooBody,
  CreateYoloFeedbackBody,
  createDroneSchema,
  createVooSchema,
  createYoloFeedbackSchema,
  SaveDroneBody,
  SaveVooBody,
  saveDroneSchema,
  saveVooSchema,
} from './dtos/create-drone.body';
import { AvaliarCondicoesVoo } from './use-cases/avaliar-condicoes-voo';
import { CreateDrone } from './use-cases/create-drone';
import { CreateVoo } from './use-cases/create-voo';
import { CreateYoloFeedback } from './use-cases/create-yolo-feedback';
import { DeleteDrone } from './use-cases/delete-drone';
import { DeleteVoo } from './use-cases/delete-voo';
import { FilterDrones } from './use-cases/filter-drones';
import { FilterPipelines } from './use-cases/filter-pipelines';
import { FilterVoos } from './use-cases/filter-voos';
import { GetPipeline } from './use-cases/get-pipeline';
import { SaveDrone } from './use-cases/save-drone';
import { SaveVoo } from './use-cases/save-voo';
import { DroneViewModel } from './view-model/drone';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Drones')
@Controller('drones')
export class DroneController {
  constructor(
    private droneFilter: FilterDrones,
    private droneCreate: CreateDrone,
    private droneSave: SaveDrone,
    private droneDelete: DeleteDrone,
    private vooFilter: FilterVoos,
    private vooCreate: CreateVoo,
    private vooSave: SaveVoo,
    private vooDelete: DeleteVoo,
    private pipelineFilter: FilterPipelines,
    private pipelineGet: GetPipeline,
    private feedbackCreate: CreateYoloFeedback,
    private avaliarCondicoesVoo: AvaliarCondicoesVoo,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Condições de Voo ─────────────────────────────────────────────────────

  @Get('condicoes-voo')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Avalia condições meteorológicas para voo baseado em pluvio_risco' })
  async condicoesVoo(
    @Query('data') dataStr: string,
  ) {
    const { data } = z.object({ data: z.coerce.date() }).parse({ data: dataStr });
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;
    return this.avaliarCondicoesVoo.execute(clienteId, data);
  }

  // ── Drones ───────────────────────────────────────────────────────────────

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar drones do cliente' })
  async listDrones() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.droneFilter.execute(clienteId);
    return items.map(DroneViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Cadastrar drone' })
  async createDrone(@Body() body: CreateDroneBody) {
    const parsed = createDroneSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const { drone } = await this.droneCreate.execute(clienteId, parsed);
    return DroneViewModel.toHttp(drone);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar drone' })
  async saveDrone(@Param('id') id: string, @Body() body: SaveDroneBody) {
    const parsed = saveDroneSchema.parse(body);
    const { drone } = await this.droneSave.execute(id, parsed);
    return DroneViewModel.toHttp(drone);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover drone' })
  async deleteDrone(@Param('id') id: string) {
    await this.droneDelete.execute(id);
    return { deleted: true };
  }

  // ── Voos ─────────────────────────────────────────────────────────────────

  @Get('voos')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar voos do cliente' })
  async listVoos() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.vooFilter.execute(clienteId);
    return items.map(DroneViewModel.vooToHttp);
  }

  @Post('voos')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Registrar voo' })
  async createVoo(@Body() body: CreateVooBody) {
    const parsed = createVooSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const { voo } = await this.vooCreate.execute(clienteId, parsed);
    return DroneViewModel.vooToHttp(voo);
  }

  @Put('voos/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar voo' })
  async saveVoo(@Param('id') id: string, @Body() body: SaveVooBody) {
    const parsed = saveVooSchema.parse(body);
    const { voo } = await this.vooSave.execute(id, parsed);
    return DroneViewModel.vooToHttp(voo);
  }

  @Delete('voos/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover voo' })
  async deleteVoo(@Param('id') id: string) {
    await this.vooDelete.execute(id);
    return { deleted: true };
  }

  // ── Pipelines ────────────────────────────────────────────────────────────

  @Get('pipelines')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar pipeline runs' })
  async listPipelines() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.pipelineFilter.execute(clienteId);
    return items.map(DroneViewModel.pipelineToHttp);
  }

  @Get('pipelines/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Detalhes da pipeline run' })
  async getPipeline(@Param('id') id: string) {
    const { pipeline } = await this.pipelineGet.execute(id);
    return DroneViewModel.pipelineToHttp(pipeline);
  }

  // ── YOLO Feedback ─────────────────────────────────────────────────────────

  @Post('yolo-feedback')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Registrar feedback YOLO (confirmado/rejeitado)' })
  async createYoloFeedback(@Body() body: CreateYoloFeedbackBody) {
    const parsed = createYoloFeedbackSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = this.req['userId'] as string | undefined;
    const { feedback } = await this.feedbackCreate.execute(clienteId, userId, parsed);
    return DroneViewModel.feedbackToHttp(feedback);
  }
}
