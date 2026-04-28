import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { uploadFotoDenunciaSchema } from '../dtos/upload-foto-denuncia.body';
import { UploadFotoException } from '../errors/upload-foto.exception';

type UploadFotoInput = z.infer<typeof uploadFotoDenunciaSchema>;

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DECODED_BYTES = 8 * 1024 * 1024;

@Injectable()
export class UploadFotoDenuncia {
  private readonly logger = new Logger(UploadFotoDenuncia.name);

  constructor(private cloudinaryService: CloudinaryService) {}

  async execute(input: UploadFotoInput): Promise<{ secure_url: string; public_id: string }> {
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
      throw UploadFotoException.invalidContentType();
    }

    const decoded = Buffer.from(input.fileBase64, 'base64');
    if (decoded.byteLength > MAX_DECODED_BYTES) {
      throw UploadFotoException.fileTooLarge();
    }

    try {
      return await this.cloudinaryService.uploadBase64Public(
        input.fileBase64,
        input.contentType,
        input.folder,
      );
    } catch (err) {
      this.logger.error(
        `Cloudinary upload falhou: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw UploadFotoException.uploadFailed();
    }
  }
}
