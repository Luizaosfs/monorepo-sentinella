import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { v2 as cloudinary } from 'cloudinary';
import { env } from 'src/lib/env/server';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private prisma: PrismaService) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(
    fileBase64: string,
    folder: string,
    contentType = 'image/jpeg',
  ): Promise<{ url: string; publicId: string }> {
    const dataUri = `data:${contentType};base64,${fileBase64}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async uploadBase64Public(
    fileBase64: string,
    contentType: string,
    folder: string,
  ): Promise<{ secure_url: string; public_id: string }> {
    const decoded = Buffer.from(fileBase64, 'base64');
    const MAX_BYTES = 8 * 1024 * 1024;
    if (decoded.byteLength > MAX_BYTES) {
      throw new Error('file_too_large');
    }
    const dataUri = `data:${contentType};base64,${fileBase64}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder });
    return { secure_url: result.secure_url, public_id: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async uploadEvidencia(
    fileBase64: string,
    clienteId: string,
    modulo: string,
  ): Promise<{ url: string; publicId: string }> {
    const folder = `sentinella/${clienteId}/${modulo}`;
    return this.upload(fileBase64, folder);
  }

  async cleanup(): Promise<void> {
    const orfaos = await this.prisma.client.cloudinary_orfaos.findMany({
      where: { processado_em: null, retention_until: { lt: new Date() } },
    });

    let deletados = 0;
    for (const orfao of orfaos) {
      try {
        await cloudinary.uploader.destroy(orfao.public_id);
        await this.prisma.client.cloudinary_orfaos.update({
          where: { id: orfao.id },
          data: { processado_em: new Date(), deletado_em: new Date() },
        });
        deletados++;
      } catch (err: any) {
        this.logger.warn(`[cleanup] Falha ao deletar ${orfao.public_id}: ${err?.message}`);
      }
    }
    this.logger.log(`[CloudinaryService.cleanup] ${deletados} órfãos removidos`);
  }

  async registrarOrfao(
    publicId: string,
    url: string,
    origemTabela: string,
    origemId?: string,
    clienteId?: string,
  ): Promise<void> {
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + 30);

    await this.prisma.client.cloudinary_orfaos.create({
      data: {
        public_id: publicId,
        url,
        origem_tabela: origemTabela,
        origem_id: origemId ?? null,
        cliente_id: clienteId ?? null,
        retention_until: retentionUntil,
      },
    });
  }
}
