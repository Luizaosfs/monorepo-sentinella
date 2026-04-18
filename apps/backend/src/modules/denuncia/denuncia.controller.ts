import { Body, Controller, Get, Post, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Public } from '@/decorators/roles.decorator';

import { DenunciaCidadaoBody, denunciaCidadaoSchema } from './dtos/denuncia-cidadao.body';
import { ConsultarDenuncia } from './use-cases/consultar-denuncia';
import { DenunciarCidadao } from './use-cases/denunciar-cidadao';

@UsePipes(MyZodValidationPipe)
@ApiTags('Denuncias')
@Controller('denuncias')
export class DenunciaController {
  constructor(
    private denunciarCidadao: DenunciarCidadao,
    private consultarDenuncia: ConsultarDenuncia,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cidadao')
  @ApiOperation({ summary: 'Registrar denúncia de cidadão (público)' })
  async denunciar(@Body() body: DenunciaCidadaoBody) {
    const parsed = denunciaCidadaoSchema.parse(body);
    return this.denunciarCidadao.execute(parsed);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('consultar')
  @ApiOperation({ summary: 'Consultar denúncia por protocolo (público)' })
  async consultar(@Query('protocolo') protocolo: string) {
    return this.consultarDenuncia.execute(protocolo?.toLowerCase());
  }
}
