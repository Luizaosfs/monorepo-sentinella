import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';

import { CloudinaryService } from './cloudinary.service';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const uploadSchema = z.object({
  fileBase64: z
    .string({ required_error: 'fileBase64 obrigatório' })
    .max(15_000_000)
    .describe('Imagem em base64 (máx ~10MB)'),
  folder: z
    .string({ required_error: 'folder obrigatório' })
    .max(200)
    .regex(/^[a-zA-Z0-9_\-/]+$/, 'folder inválido')
    .describe('Pasta de destino no Cloudinary'),
  contentType: z
    .enum(ALLOWED_CONTENT_TYPES)
    .optional()
    .default('image/jpeg')
    .describe('MIME type da imagem'),
});

const uploadEvidenciaSchema = z.object({
  fileBase64: z
    .string({ required_error: 'fileBase64 obrigatório' })
    .max(15_000_000)
    .describe('Imagem em base64 (máx ~10MB)'),
  modulo: z
    .string({ required_error: 'modulo obrigatório' })
    .regex(/^[a-z_-]{2,50}$/, 'modulo inválido')
    .describe('Módulo de origem (vistoria, levantamento, foco, etc.)'),
});

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(
    private cloudinaryService: CloudinaryService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Post('upload')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Upload de imagem em base64' })
  async upload(@Body() body: unknown) {
    const parsed = uploadSchema.parse(body);
    return this.cloudinaryService.upload(parsed.fileBase64, parsed.folder, parsed.contentType);
  }

  @Delete(':publicId')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar imagem por publicId' })
  async delete(@Param('publicId') publicId: string) {
    const safeId = z.string().min(1).max(512).regex(/^[a-zA-Z0-9_\-/.]+$/).safeParse(publicId);
    if (!safeId.success) throw new ForbiddenException('publicId inválido');

    const user = this.req['user'] as AuthenticatedUser | undefined;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!user?.isPlatformAdmin && tenantId) {
      if (!safeId.data.startsWith(`sentinella/${tenantId}/`)) {
        throw new ForbiddenException('Acesso negado: imagem pertence a outro tenant');
      }
    }

    await this.cloudinaryService.delete(safeId.data);
    return { deleted: true };
  }

  @Post('upload-evidencia')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Upload de evidência vinculada a módulo' })
  async uploadEvidencia(@Body() body: unknown) {
    const parsed = uploadEvidenciaSchema.parse(body);
    const tenantId = this.req['tenantId'] as string;
    return this.cloudinaryService.uploadEvidencia(parsed.fileBase64, tenantId, parsed.modulo);
  }
}
