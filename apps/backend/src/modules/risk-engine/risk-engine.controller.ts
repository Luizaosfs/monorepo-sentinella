import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  FilterRiskPolicyInput,
  filterRiskPolicySchema,
} from './dtos/filter-risk-policy.input';
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

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
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
    private readRepository: RiskEngineReadRepository,
    private writeRepository: RiskEngineWriteRepository,
  ) {}

  // ── Policy ────────────────────────────────────────────────────────────────

  @Get('policy')
  @Roles('admin', 'supervisor', 'analista_regional')
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
  @Roles('admin', 'supervisor', 'analista_regional')
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
    await this.writeRepository.deletePolicy(id);
    return { success: true };
  }

  // ── Drone config ──────────────────────────────────────────────────────────

  @Get('drone-config')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Configuração de risco para drone/YOLO do cliente' })
  async getDroneConfig(@Query('clienteId') clienteId?: string) {
    const { config } = await this.getDroneConfigUC.execute(clienteId);
    return DroneRiskConfigViewModel.toHttp(config);
  }

  @Put('drone-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar configuração de drone do cliente' })
  async saveDroneConfig(
    @Body() body: SaveDroneConfigBody,
    @Query('clienteId') clienteId?: string,
  ) {
    const parsed = saveDroneConfigSchema.parse(body);
    const { config } = await this.saveDroneConfigUC.execute(parsed, clienteId);
    return DroneRiskConfigViewModel.toHttp(config);
  }

  // ── YOLO classes ──────────────────────────────────────────────────────────

  @Get('yolo-classes')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Listar classes YOLO do cliente' })
  async filterYoloClasses(@Query('clienteId') clienteId?: string) {
    const { classes } = await this.filterYoloClassesUC.execute(clienteId);
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
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Listar sinônimos YOLO do cliente' })
  async filterYoloSynonyms(@Query('clienteId') clienteId?: string) {
    const { synonyms } = await this.filterYoloSynonymsUC.execute(clienteId);
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
    await this.writeRepository.deleteYoloSynonym(id);
    return { success: true };
  }
}
