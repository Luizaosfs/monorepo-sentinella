import { createHash } from 'node:crypto';
import { Body, Controller, Get, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Public } from '@/decorators/roles.decorator';
import { env } from '@/lib/env/server';

import { DenunciaCidadaoBody, denunciaCidadaoSchema } from './dtos/denuncia-cidadao.body';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadao } from './use-cases/denunciar-cidadao';
import { DenunciarCidadaoV2 } from './use-cases/denunciar-cidadao-v2';

@UsePipes(MyZodValidationPipe)
@ApiTags('Denuncias')
@Controller('denuncias')
export class DenunciaController {
  constructor(
    private denunciarCidadao: DenunciarCidadao,
    private denunciarCidadaoV2: DenunciarCidadaoV2,
    private consultarDenuncia: ConsultarDenuncia,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cidadao')
  @ApiOperation({ summary: 'Registrar denúncia de cidadão (público)' })
  async denunciar(@Body() body: DenunciaCidadaoBody, @Req() req: Request) {
    const parsed = denunciaCidadaoSchema.parse(body);

    if (env.CANAL_CIDADAO_V2_ENABLED) {
      const rawIp = req.ip ?? '';
      const ipHash = rawIp
        ? createHash('sha256').update(rawIp + env.CANAL_CIDADAO_IP_SALT).digest('hex')
        : '';
      return this.denunciarCidadaoV2.execute(parsed, ipHash);
    }

    return this.denunciarCidadao.execute(parsed);
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
