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
import { TenantGuard } from 'src/guards/tenant.guard';
import { AuthenticatedUser } from 'src/guards/auth.guard';
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
import {
  AddSynonymBody,
  addSynonymSchema,
  BulkCreateVoosBody,
  bulkCreateVoosSchema,
  UpdateDroneRiskConfigBody,
  updateDroneRiskConfigSchema,
  UpdateYoloClassBody,
  updateYoloClassSchema,
} from './dtos/drone-yolo.body';
import { AddSynonym } from './use-cases/add-synonym';
import { AvaliarCondicoesVoo } from './use-cases/avaliar-condicoes-voo';
import { BulkCreateVoos } from './use-cases/bulk-create-voos';
import { CreateDrone } from './use-cases/create-drone';
import { CreateVoo } from './use-cases/create-voo';
import { CreateYoloFeedback } from './use-cases/create-yolo-feedback';
import { DeleteDrone } from './use-cases/delete-drone';
import { DeleteSynonym } from './use-cases/delete-synonym';
import { DeleteVoo } from './use-cases/delete-voo';
import { FilterDrones } from './use-cases/filter-drones';
import { FilterPipelines } from './use-cases/filter-pipelines';
import { FilterVoos } from './use-cases/filter-voos';
import { GetDroneRiskConfig } from './use-cases/get-drone-risk-config';
import { GetPipeline } from './use-cases/get-pipeline';
import { GetYoloFeedbackByItem } from './use-cases/get-yolo-feedback-by-item';
import { ListSynonyms } from './use-cases/list-synonyms';
import { ListYoloClassConfig } from './use-cases/list-yolo-class-config';
import { ListYoloClasses } from './use-cases/list-yolo-classes';
import { SaveDrone } from './use-cases/save-drone';
import { SaveVoo } from './use-cases/save-voo';
import { UpdateDroneRiskConfig } from './use-cases/update-drone-risk-config';
import { UpdateYoloClass } from './use-cases/update-yolo-class';
import { YoloQualidadeResumo } from './use-cases/yolo-qualidade-resumo';
import { DroneViewModel } from './view-model/drone';

@UseGuards(TenantGuard)
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
    private vooBulkCreate: BulkCreateVoos,
    private pipelineFilter: FilterPipelines,
    private pipelineGet: GetPipeline,
    private feedbackCreate: CreateYoloFeedback,
    private feedbackGetByItem: GetYoloFeedbackByItem,
    private avaliarCondicoesVoo: AvaliarCondicoesVoo,
    private yoloClassConfigList: ListYoloClassConfig,
    private yoloQualidadeResumoUc: YoloQualidadeResumo,
    private riskConfigGet: GetDroneRiskConfig,
    private riskConfigUpdate: UpdateDroneRiskConfig,
    private yoloClassesList: ListYoloClasses,
    private yoloClassUpdate: UpdateYoloClass,
    private synonymsList: ListSynonyms,
    private synonymAdd: AddSynonym,
    private synonymDelete: DeleteSynonym,
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

  @Post('voos/bulk-create')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Importar voos em lote (chunks de 50, skipDuplicates)' })
  async bulkCreateVoos(@Body() body: BulkCreateVoosBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = bulkCreateVoosSchema.parse(body);
    return this.vooBulkCreate.execute(clienteId, parsed);
  }

  // ── YOLO Feedback ─────────────────────────────────────────────────────────

  @Get('yolo-feedback/by-item')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar feedback YOLO de um item específico' })
  async getYoloFeedbackByItem(@Query('levantamentoItemId') levantamentoItemId: string) {
    const clienteId = this.req['tenantId'] as string;
    const { feedback } = await this.feedbackGetByItem.execute(levantamentoItemId, clienteId);
    return feedback ?? null;
  }

  @Post('yolo-feedback')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Registrar feedback YOLO (confirmado/rejeitado)' })
  async createYoloFeedback(@Body() body: CreateYoloFeedbackBody) {
    const parsed = createYoloFeedbackSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser).id;
    const { feedback } = await this.feedbackCreate.execute(clienteId, userId, parsed);
    return DroneViewModel.feedbackToHttp(feedback);
  }

  // ── YOLO Class Config ─────────────────────────────────────────────────────

  @Get('yolo-class-config')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar classes YOLO ativas do cliente' })
  async listYoloClassConfig() {
    const clienteId = this.req['tenantId'] as string;
    return this.yoloClassConfigList.execute(clienteId);
  }

  // ── YOLO Qualidade ────────────────────────────────────────────────────────

  @Get('yolo-qualidade/resumo')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Resumo de qualidade YOLO (precisão, cobertura, correlações)' })
  async yoloQualidadeResumo() {
    const clienteId = this.req['tenantId'] as string;
    return this.yoloQualidadeResumoUc.execute(clienteId);
  }

  // ── Drone Risk Config ─────────────────────────────────────────────────────

  @Get('risk-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar configuração de risco drone do cliente' })
  async getRiskConfig() {
    const clienteId = this.req['tenantId'] as string;
    return this.riskConfigGet.execute(clienteId);
  }

  @Put('risk-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar configuração de risco drone' })
  async updateRiskConfig(@Body() body: UpdateDroneRiskConfigBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = updateDroneRiskConfigSchema.parse(body);
    await this.riskConfigUpdate.execute(clienteId, parsed);
    return { ok: true };
  }

  @Get('risk-config/yolo-classes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar todas as classes YOLO do cliente (incluindo inativas)' })
  async listYoloClasses() {
    const clienteId = this.req['tenantId'] as string;
    return this.yoloClassesList.execute(clienteId);
  }

  @Put('risk-config/yolo-classes/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar classe YOLO (campos parciais)' })
  async updateYoloClass(@Param('id') id: string, @Body() body: UpdateYoloClassBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = updateYoloClassSchema.parse(body);
    await this.yoloClassUpdate.execute(id, clienteId, parsed);
    return { ok: true };
  }

  @Get('risk-config/synonyms')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar sinônimos YOLO do cliente' })
  async listSynonyms() {
    const clienteId = this.req['tenantId'] as string;
    return this.synonymsList.execute(clienteId);
  }

  @Post('risk-config/synonyms')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Adicionar sinônimo YOLO' })
  async addSynonym(@Body() body: AddSynonymBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = addSynonymSchema.parse(body);
    return this.synonymAdd.execute(clienteId, parsed);
  }

  @Delete('risk-config/synonyms/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover sinônimo YOLO' })
  async deleteSynonym(@Param('id') id: string) {
    const clienteId = this.req['tenantId'] as string;
    await this.synonymDelete.execute(id, clienteId);
    return { ok: true };
  }
}
