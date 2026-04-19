import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { ListTags } from './use-cases/list-tags';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(
    private listTagsUc: ListTags,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Listar tags disponíveis (globais + do cliente)' })
  async list() {
    const clienteId = this.req['tenantId'] as string | undefined;
    return this.listTagsUc.execute(clienteId);
  }
}
