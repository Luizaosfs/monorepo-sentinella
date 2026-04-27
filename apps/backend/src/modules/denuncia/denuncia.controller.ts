import { createHash } from 'node:crypto';
import { Body, Controller, Get, Inject, Post, Query, Req, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { z } from 'zod';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Public, Roles } from '@/decorators/roles.decorator';
import { env } from '@/lib/env/server';

import { DenunciaCidadaoBody, denunciaCidadaoSchema } from './dtos/denuncia-cidadao.body';
import { UploadFotoDenunciaBody, uploadFotoDenunciaSchema } from './dtos/upload-foto-denuncia.body';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadaoV2 } from './use-cases/denunciar-cidadao-v2';
import { CanalCidadaoStats } from './use-cases/canal-cidadao-stats';
import { UploadFotoDenuncia } from './use-cases/upload-foto-denuncia';

@UsePipes(MyZodValidationPipe)
@UseInterceptors(PrismaInterceptor)
@ApiTags('Denuncias')
@Controller('denuncias')
export class DenunciaController {
  constructor(
    private denunciarCidadaoV2: DenunciarCidadaoV2,
    private consultarDenuncia: ConsultarDenuncia,
    private canalCidadaoStats: CanalCidadaoStats,
    private uploadFotoDenuncia: UploadFotoDenuncia,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cidadao')
  @ApiOperation({ summary: 'Registrar denúncia de cidadão (público)' })
  async denunciar(@Body() body: DenunciaCidadaoBody, @Req() req: Request) {
    const parsed = denunciaCidadaoSchema.parse(body);
    const rawIp = req.ip ?? '';
    const ipHash = rawIp
      ? createHash('sha256').update(rawIp + env.CANAL_CIDADAO_IP_SALT).digest('hex')
      : '';
    return this.denunciarCidadaoV2.execute(parsed, ipHash);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('upload-foto')
  @ApiOperation({ summary: 'Upload de foto de denúncia (público, rate-limited)' })
  async uploadFoto(@Body() body: UploadFotoDenunciaBody) {
    const parsed = uploadFotoDenunciaSchema.parse(body);
    return this.uploadFotoDenuncia.execute(parsed);
  }

  @Get('stats')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Estatísticas do canal cidadão (substitui v_canal_cidadao_stats)' })
  async stats() {
    const clienteId = this.req['tenantId'] as string;
    return this.canalCidadaoStats.execute(clienteId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('consultar')
  @ApiOperation({ summary: 'Consultar denúncia por protocolo (público)' })
  async consultar(@Query('protocolo') protocolo: string) {
    const parsed = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/).safeParse(protocolo);
    if (!parsed.success) return null;
    return this.consultarDenuncia.execute(parsed.data.toLowerCase());
  }
}
