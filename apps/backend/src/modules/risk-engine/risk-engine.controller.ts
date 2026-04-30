import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  FilterRiskPolicyInput,
  filterRiskPolicySchema,
} from './dtos/filter-risk-policy.input';
import { ScoreConfigInput } from './repositories/risk-engine-write.repository';
import {
  SaveDroneConfigBody,
  saveDroneConfigSchema,
  savePolicyFullSchema,
  SavePolicyFullBody,
  SaveRiskPolicyBody,
  savePolicySchema,
  SaveYoloClassBody,
  saveYoloClassSchema,
  SaveYoloSynonymBody,
  saveYoloSynonymSchema,
} from './dtos/save-risk-policy.body';
import { FilterYoloClasses } from './use-cases/filter-yolo-classes';
import { FilterYoloSynonyms } from './use-cases/filter-yolo-synonyms';
import { GetDroneConfig } from './use-cases/get-drone-config';
import { GetPolicy } from './use-cases/get-policy';
import { GetPolicyFull } from './use-cases/get-policy-full';
import { SaveDroneConfig } from './use-cases/save-drone-config';
import { SavePolicy } from './use-cases/save-policy';
import { SavePolicyFull } from './use-cases/save-policy-full';
import { SaveYoloClass } from './use-cases/save-yolo-class';
import { SaveYoloSynonym } from './use-cases/save-yolo-synonym';
import { GetScoreBairro } from './use-cases/get-score-bairro';
import {
  DroneRiskConfigViewModel,
  RiskPolicyFullViewModel,
  RiskPolicyViewModel,
  YoloClassConfigViewModel,
  YoloSynonymViewModel,
} from './view-model/risk-engine';
import { RiskEngineReadRepository } from './repositories/risk-engine-read.repository';
import { RiskEngineWriteRepository } from './repositories/risk-engine-write.repository';
import { RiskEngineException } from './errors/risk-engine.exception';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Risk Engine')
@Controller('risk-engine')
export class RiskEngineController {
  constructor(
    private getPolicyUC: GetPolicy,
    private savePolicyUC: SavePolicy,
    private getPolicyFullUC: GetPolicyFull,
    private savePolicyFullUC: SavePolicyFull,
    private getDroneConfigUC: GetDroneConfig,
    private saveDroneConfigUC: SaveDroneConfig,
    private filterYoloClassesUC: FilterYoloClasses,
    private saveYoloClassUC: SaveYoloClass,
    private filterYoloSynonymsUC: FilterYoloSynonyms,
    private saveYoloSynonymUC: SaveYoloSynonym,
    private getScoreBairro: GetScoreBairro,
    private readRepository: RiskEngineReadRepository,
    private writeRepository: RiskEngineWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Policy ────────────────────────────────────────────────────────────────

  @Get('policy')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar políticas de risco do cliente' })
  async getPolicy(@Query() filters: FilterRiskPolicyInput) {
    const parsed = filterRiskPolicySchema.parse(filters);
    const { policies } = await this.getPolicyUC.execute(parsed);
    return policies.map(RiskPolicyViewModel.toHttp);
  }

  @Put('policy')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ou atualizar cabeçalho de política' })
  async savePolicy(@Body() body: SaveRiskPolicyBody, @Query('id') id?: string) {
    const parsed = savePolicySchema.parse(body);
    const { policy } = await this.savePolicyUC.execute({ ...parsed, id });
    return RiskPolicyViewModel.toHttp(policy);
  }

  @Get('policy/:id/full')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Carregar política com todas as sub-tabelas' })
  async getPolicyFull(@Param('id') id: string) {
    const { full } = await this.getPolicyFullUC.execute(id);
    return RiskPolicyFullViewModel.toHttp(full);
  }

  @Put('policy/:id/full')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Salvar política + sub-tabelas em transação (delete + re-insert)' })
  async savePolicyFull(
    @Param('id') id: string,
    @Body() body: SavePolicyFullBody,
  ) {
    const parsed = savePolicyFullSchema.parse(body);
    const { full } = await this.savePolicyFullUC.execute(id, parsed);
    return RiskPolicyFullViewModel.toHttp(full);
  }

  @Delete('policy/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar política de risco' })
  async deletePolicy(@Param('id') id: string) {
    const existing = await this.readRepository.findPolicyById(id);
    if (!existing) throw RiskEngineException.notFound();
    const tenantId = getAccessScope(this.req).tenantId ?? undefined;
    const user = this.req['user'] as any;
    if (tenantId && !user?.isPlatformAdmin && existing.clienteId !== tenantId) {
      throw RiskEngineException.notFound();
    }
    await this.writeRepository.deletePolicy(id);
    return { success: true };
  }

  // ── Drone config ──────────────────────────────────────────────────────────

  @Get('drone-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Configuração de risco para drone/YOLO do cliente' })
  async getDroneConfig() {
    const { config } = await this.getDroneConfigUC.execute();
    return DroneRiskConfigViewModel.toHttp(config);
  }

  @Put('drone-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar configuração de drone do cliente' })
  async saveDroneConfig(
    @Body() body: SaveDroneConfigBody,
  ) {
    const parsed = saveDroneConfigSchema.parse(body);
    const { config } = await this.saveDroneConfigUC.execute(parsed);
    return DroneRiskConfigViewModel.toHttp(config);
  }

  // ── YOLO classes ──────────────────────────────────────────────────────────

  @Get('yolo-classes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar classes YOLO do cliente' })
  async filterYoloClasses() {
    const { classes } = await this.filterYoloClassesUC.execute();
    return classes.map(YoloClassConfigViewModel.toHttp);
  }

  @Put('yolo-classes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar classe YOLO' })
  async saveYoloClass(@Body() body: SaveYoloClassBody) {
    const parsed = saveYoloClassSchema.parse(body);
    const { yoloClass } = await this.saveYoloClassUC.execute(parsed);
    return YoloClassConfigViewModel.toHttp(yoloClass);
  }

  // ── YOLO synonyms ─────────────────────────────────────────────────────────

  @Get('yolo-synonyms')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar sinônimos YOLO do cliente' })
  async filterYoloSynonyms() {
    const { synonyms } = await this.filterYoloSynonymsUC.execute();
    return synonyms.map(YoloSynonymViewModel.toHttp);
  }

  @Post('yolo-synonyms')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Adicionar sinônimo YOLO' })
  async saveYoloSynonym(@Body() body: SaveYoloSynonymBody) {
    const parsed = saveYoloSynonymSchema.parse(body);
    const { synonym } = await this.saveYoloSynonymUC.execute(parsed);
    return YoloSynonymViewModel.toHttp(synonym);
  }

  @Delete('yolo-synonyms/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar sinônimo YOLO' })
  async deleteYoloSynonym(@Param('id') id: string) {
    const tenantId = getAccessScope(this.req).tenantId ?? undefined;
    await this.writeRepository.deleteYoloSynonym(id, tenantId);
    return { success: true };
  }

  // ── Score territorial ─────────────────────────────────────────────────────

  @Get('score')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Top imóveis críticos por score territorial' })
  async listTopCriticos(@Query('limit') limit?: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.findTopCriticos(clienteId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('policy/cliente-ids')
  @Roles('admin')
  @ApiOperation({ summary: 'IDs de todos os clientes com políticas de risco (admin)' })
  async listAllClienteIds() {
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT DISTINCT cliente_id FROM risk_policy_headers WHERE deleted_at IS NULL ORDER BY cliente_id`,
    );
  }

  @Get('score/bairros')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Score agregado por bairro' })
  listScoreBairros() {
    return this.getScoreBairro.execute(requireTenantId(getAccessScope(this.req)));
  }

  @Get('score/imovel/:imovelId')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Score territorial de um imóvel' })
  async getScoreImovel(@Param('imovelId') imovelId: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.findScoreByImovel(imovelId, clienteId);
  }

  @Get('score/config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Configuração de pesos do score territorial' })
  async getScoreConfig() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.findScoreConfig(clienteId);
  }

  @Put('score/config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar configuração de pesos do score territorial' })
  async upsertScoreConfig(@Body() body: ScoreConfigInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.writeRepository.upsertScoreConfig(clienteId, body);
  }

  @Post('score/recalcular')
  @Roles('admin', 'supervisor')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enfileirar recálculo do score territorial' })
  async forcarRecalculo() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    await this.writeRepository.enqueueScoreRecalculo(clienteId);
    return { queued: true };
  }
}
