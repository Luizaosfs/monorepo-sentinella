import {
  BadRequestException,
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
import { z, ZodError } from 'zod';

import { Roles } from '@/decorators/roles.decorator';
import {
  getAccessScope,
  getClienteIdsPermitidos,
  requireTenantId,
} from '@/shared/security/access-scope.helpers';

import { IaService } from './ia.service';

const identifyLarvaSchema = z
  .object({
    // camelCase (current)
    imageBase64: z.string().optional(),
    contentType: z.string().optional(),
    depositoTipo: z.string().optional(),
    // snake_case (legacy clients)
    image_base64: z.string().optional(),
    content_type: z.string().optional(),
    deposito_tipo: z.string().optional(),
    clienteId: z.string().uuid().optional(),
  })
  .transform((d) => ({
    imageBase64: d.imageBase64 ?? d.image_base64 ?? '',
    contentType: d.contentType ?? d.content_type ?? 'image/jpeg',
    depositoTipo: d.depositoTipo ?? d.deposito_tipo,
    clienteId: d.clienteId,
  }))
  .refine((d) => d.imageBase64.length > 0, {
    message: 'imageBase64 obrigatório',
    path: ['imageBase64'],
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
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.iaService.getAnaliseByLevantamento(levantamentoId, clienteId);
  }

  @Get('insights')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar insights regionais em cache (valido_ate > now)' })
  async getInsights(@Query('tipo') tipo?: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.iaService.getInsights(clienteId, tipo);
  }

  @Post('identify-larva')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Identificar larvas de Aedes via IA (Claude Vision)' })
  async identifyLarva(@Body() body: unknown) {
    let parsed: ReturnType<typeof identifyLarvaSchema['parse']>;
    try {
      parsed = identifyLarvaSchema.parse(body);
    } catch (err) {
      const msg = err instanceof ZodError ? err.issues[0]?.message : 'Payload inválido';
      throw new BadRequestException(msg);
    }
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.iaService.identifyLarva({ ...parsed, clienteId });
  }

  @Post('insights-regional')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Gerar insights regionais via IA' })
  async insightsRegional() {
    const clienteId = getAccessScope(this.req).tenantId;
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
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.iaService.triagemPosVoo(parsed.levantamentoId, clienteId);
  }
}
