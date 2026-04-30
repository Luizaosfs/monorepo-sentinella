import { Body, Controller, Inject, Post, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';

import { SeedService } from './seed.service';

const riskPolicySchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  rules: z.array(z.record(z.unknown())).optional(),
});

const slaConfigSchema = z.object({
  config: z.record(z.unknown()),
});

const planoAcaoSchema = z.object({
  items: z.array(z.object({
    label: z.string(),
    descricao: z.string().optional(),
    tipo_item: z.string().optional(),
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional(),
  })),
});

const slaFeriadosSchema = z.object({
  feriados: z.array(z.object({
    data: z.string(),
    descricao: z.string(),
    nacional: z.boolean().optional(),
  })),
});

const droneRiskConfigSchema = z.object({
  config: z.object({
    base_by_risco: z.record(z.unknown()).optional(),
    priority_thresholds: z.record(z.unknown()).optional(),
    sla_by_priority_hours: z.record(z.unknown()).optional(),
    confidence_multiplier: z.number().optional(),
    item_overrides: z.record(z.unknown()).optional(),
  }).default({}),
  yoloClasses: z.array(z.object({
    item_key: z.string(),
    item: z.string(),
    risco: z.string(),
    peso: z.number().int(),
    acao: z.string().optional(),
    is_active: z.boolean().optional(),
  })).default([]),
  synonyms: z.array(z.object({
    synonym: z.string(),
    maps_to: z.string(),
  })).default([]),
});

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(
    private seedService: SeedService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Post('risk-policy')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Seed política de risco padrão' })
  async riskPolicy(@Body() body: unknown) {
    const parsed = riskPolicySchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.seedService.seedRiskPolicy(clienteId, parsed);
  }

  @Post('sla-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Seed configuração padrão de SLA' })
  async slaConfig(@Body() body: unknown) {
    const { config } = slaConfigSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.seedService.seedSlaConfig(clienteId, config);
  }

  @Post('plano-acao-catalogo')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Seed catálogo padrão de plano de ação' })
  async planoAcaoCatalogo(@Body() body: unknown) {
    const { items } = planoAcaoSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.seedService.seedPlanoAcaoCatalogo(clienteId, items);
  }

  @Post('sla-feriados')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Seed feriados padrão de SLA' })
  async slaFeriados(@Body() body: unknown) {
    const { feriados } = slaFeriadosSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.seedService.seedSlaFeriados(clienteId, feriados);
  }

  @Post('drone-risk-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Seed configuração de risco de drone (YOLO classes + config)' })
  async droneRiskConfig(@Body() body: unknown) {
    const { config, yoloClasses, synonyms } = droneRiskConfigSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.seedService.seedDroneRiskConfig(clienteId, config, yoloClasses, synonyms);
  }
}
