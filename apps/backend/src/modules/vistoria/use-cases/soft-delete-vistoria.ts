import { ForbiddenException, Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { AuthenticatedUser } from '@/guards/auth.guard';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { VistoriaException } from '../errors/vistoria.exception';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class SoftDeleteVistoria {
  private readonly logger = new Logger(SoftDeleteVistoria.name);

  constructor(
    private readRepository: VistoriaReadRepository,
    private writeRepository: VistoriaWriteRepository,
    private cloudinaryService: CloudinaryService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string): Promise<void> {
    const vistoria = await this.readRepository.findByIdIncludingDeleted(id);
    if (!vistoria) throw VistoriaException.notFound();

    assertTenantOwnership(vistoria.clienteId, this.req);

    const user = this.req['user'] as AuthenticatedUser | undefined;
    const isSupervisorOuAdmin =
      user?.isPlatformAdmin || (user?.papeis ?? []).includes('supervisor');
    if (!isSupervisorOuAdmin) {
      throw new ForbiddenException('Apenas supervisor ou admin pode excluir vistoria');
    }

    if (vistoria.deletedAt) {
      return;
    }

    await this.writeRepository.softDelete(id);

    // K.7 — fn_orfaos_vistoria: registra imagens órfãs no Cloudinary (best-effort)
    await this.registrarOrfaos(vistoria);
  }

  private async registrarOrfaos(vistoria: {
    id: string | undefined;
    clienteId: string;
    assinaturaPublicId: string | undefined;
    assinaturaResponsavelUrl: string | undefined;
    fotoExternaPublicId: string | undefined;
    fotoExternaUrl: string | undefined;
  }): Promise<void> {
    if (vistoria.assinaturaPublicId) {
      try {
        await this.cloudinaryService.registrarOrfao(
          vistoria.assinaturaPublicId,
          vistoria.assinaturaResponsavelUrl ?? '',
          'vistorias',
          vistoria.id,
          vistoria.clienteId,
        );
      } catch (err) {
        this.logger.error(
          `[SoftDeleteVistoria] K.7 assinatura falhou: ${(err as Error).message}`,
        );
      }
    }

    if (vistoria.fotoExternaPublicId) {
      try {
        await this.cloudinaryService.registrarOrfao(
          vistoria.fotoExternaPublicId,
          vistoria.fotoExternaUrl ?? '',
          'vistorias',
          vistoria.id,
          vistoria.clienteId,
        );
      } catch (err) {
        this.logger.error(
          `[SoftDeleteVistoria] K.7 foto_externa falhou: ${(err as Error).message}`,
        );
      }
    }

    try {
      const calhas = await this.readRepository.findCalhasByVistoriaId(vistoria.id!);
      for (const calha of calhas) {
        if (!calha.fotoPublicId) continue;
        try {
          await this.cloudinaryService.registrarOrfao(
            calha.fotoPublicId,
            calha.fotoUrl ?? '',
            'vistoria_calhas',
            calha.id,
            vistoria.clienteId,
          );
        } catch (err) {
          this.logger.error(
            `[SoftDeleteVistoria] K.7 calha ${calha.id} falhou: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[SoftDeleteVistoria] K.7 listagem de calhas falhou: ${(err as Error).message}`,
      );
    }
  }
}
