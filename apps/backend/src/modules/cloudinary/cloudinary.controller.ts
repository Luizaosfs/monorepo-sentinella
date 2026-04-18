import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';

import { CloudinaryService } from './cloudinary.service';

const uploadSchema = z.object({
  fileBase64: z
    .string({ required_error: 'fileBase64 obrigatório' })
    .describe('Imagem em base64'),
  folder: z
    .string({ required_error: 'folder obrigatório' })
    .describe('Pasta de destino no Cloudinary'),
  contentType: z
    .string()
    .optional()
    .default('image/jpeg')
    .describe('MIME type da imagem (ex: image/jpeg, image/png)'),
});

const uploadEvidenciaSchema = z.object({
  fileBase64: z
    .string({ required_error: 'fileBase64 obrigatório' })
    .describe('Imagem em base64'),
  clienteId: z
    .string({ required_error: 'clienteId obrigatório' })
    .uuid()
    .describe('ID do cliente (tenant)'),
  modulo: z
    .string({ required_error: 'modulo obrigatório' })
    .describe('Módulo de origem (vistoria, levantamento, foco, etc.)'),
});

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private cloudinaryService: CloudinaryService) {}

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
    await this.cloudinaryService.delete(publicId);
    return { deleted: true };
  }

  @Post('upload-evidencia')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Upload de evidência vinculada a módulo' })
  async uploadEvidencia(@Body() body: unknown) {
    const parsed = uploadEvidenciaSchema.parse(body);
    return this.cloudinaryService.uploadEvidencia(
      parsed.fileBase64,
      parsed.clienteId,
      parsed.modulo,
    );
  }
}
