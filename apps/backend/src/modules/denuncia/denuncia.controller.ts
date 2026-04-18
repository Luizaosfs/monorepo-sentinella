import { Body, Controller, Get, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { Request } from 'express';

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
  @Post('cidadao')
  @ApiOperation({ summary: 'Registrar denúncia de cidadão (público)' })
  async denunciar(@Body() body: DenunciaCidadaoBody, @Req() req: Request) {
    const parsed = denunciaCidadaoSchema.parse(body);
    const authId = (req['user'] as any)?.sub as string | undefined;
    return this.denunciarCidadao.execute(parsed, authId);
  }

  @Public()
  @Get('consultar')
  @ApiOperation({ summary: 'Consultar denúncia por protocolo (público)' })
  async consultar(@Query('protocolo') protocolo: string) {
    return this.consultarDenuncia.execute(protocolo?.toLowerCase());
  }
}
