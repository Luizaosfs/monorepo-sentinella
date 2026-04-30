import { Body, Controller, Post, Req, UseInterceptors, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';

const pilotoEventoSchema = z.object({
  tipo: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
});

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Piloto')
@Controller('piloto')
export class PilotoController {
  constructor(private prisma: PrismaService) {}

  @Post('eventos')
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Registrar evento de piloto (fire-and-forget)' })
  async logEvento(@Body() body: unknown, @Req() req: Request) {
    const parsed = pilotoEventoSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(req));
    const usuarioId = (req['user'] as AuthenticatedUser).id;

    // fire-and-forget — não bloqueia, nunca lança exceção
    this.prisma.client.piloto_eventos
      .create({
        data: {
          cliente_id: clienteId,
          usuario_id: usuarioId ?? null,
          tipo: parsed.tipo,
          payload: parsed.payload as any,
        },
      })
      .catch(() => {});

    return { ok: true };
  }
}
