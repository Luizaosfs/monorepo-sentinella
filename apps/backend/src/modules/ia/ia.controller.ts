import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';
import {
  getAccessScope,
  getClienteIdsPermitidos,
} from '@/shared/security/access-scope.helpers';

import { IaService } from './ia.service';

const identifyLarvaSchema = z.object({
  imageBase64: z
    .string({ required_error: 'imageBase64 obrigatório' })
    .describe('Imagem em base64'),
  contentType: z
    .string()
    .optional()
    .default('image/jpeg')
    .describe('MIME type da imagem'),
  depositoTipo: z.string().optional().describe('Tipo do depósito (caixa d\'água, pneu, etc.)'),
  clienteId: z.string().uuid().optional().describe('ID do cliente (sobreposição para admin)'),
});

const triagemSchema = z.object({
  levantamentoId: z
    .string({ required_error: 'levantamentoId obrigatório' })
    .uuid()
    .describe('ID do levantamento a triar'),
  clienteId: z.string().uuid().optional().describe('ID do cliente (sobreposição para admin)'),
});

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('IA')
@Controller('ia')
export class IaController {
  constructor(
    private iaService: IaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('analise/:levantamentoId')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar análise IA de um levantamento' })
  async getAnalise(@Param('levantamentoId') levantamentoId: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.iaService.getAnaliseByLevantamento(levantamentoId, clienteId);
  }

  @Get('insights')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar insights regionais em cache (valido_ate > now)' })
  async getInsights(@Query('tipo') tipo?: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.iaService.getInsights(clienteId, tipo);
  }

  @Post('identify-larva')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Identificar larvas de Aedes via IA (Claude Vision)' })
  async identifyLarva(@Body() body: unknown) {
    const parsed = identifyLarvaSchema.parse(body);
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;
    return this.iaService.identifyLarva({ ...parsed, clienteId });
  }

  @Post('insights-regional')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Gerar insights regionais via IA' })
  async insightsRegional() {
    const clienteId = (this.req['tenantId'] as string | undefined) ?? null;
    return this.iaService.insightsRegional(clienteId);
  }

  @Post('graficos-regionais')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Gerar dados de gráficos regionais' })
  async graficosRegionais() {
    const scope = getAccessScope(this.req);
    const clienteIds = getClienteIdsPermitidos(scope);
    return this.iaService.graficosRegionais(clienteIds);
  }

  @Post('triagem-pos-voo')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Triagem pós-voo com clustering geográfico e IA' })
  async triagemPosVoo(@Body() body: unknown) {
    const parsed = triagemSchema.parse(body);
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;
    return this.iaService.triagemPosVoo(parsed.levantamentoId, clienteId);
  }
}
