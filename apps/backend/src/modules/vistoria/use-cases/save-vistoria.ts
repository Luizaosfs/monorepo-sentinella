import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { SaveVistoriaBody } from '../dtos/save-vistoria.body';
import { VistoriaException } from '../errors/vistoria.exception';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';
import { AtualizarPerfilImovel } from './atualizar-perfil-imovel';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable({ scope: Scope.REQUEST })
export class SaveVistoria {
  private readonly logger = new Logger(SaveVistoria.name);

  constructor(
    private readRepository: VistoriaReadRepository,
    private writeRepository: VistoriaWriteRepository,
    private consolidarVistoria: ConsolidarVistoria,
    private atualizarPerfilImovel: AtualizarPerfilImovel,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, data: SaveVistoriaBody) {
    const tenantId = requireTenantId(getAccessScope(this.req));
    const vistoria = await this.readRepository.findById(id, tenantId);
    if (!vistoria) throw VistoriaException.notFound();

    // Snapshot ANTES das mutações — paridade com OLD do trigger SQL
    const antes = {
      acessoRealizado: vistoria.acessoRealizado,
      status: vistoria.status,
      moradoresQtd: vistoria.moradoresQtd,
      gravidas: vistoria.gravidas,
      idosos: vistoria.idosos,
      criancas7anos: vistoria.criancas7anos,
    };

    if (data.agenteId !== undefined) vistoria.agenteId = data.agenteId;
    if (data.status !== undefined) vistoria.status = data.status;
    if (data.dataVisita !== undefined) vistoria.dataVisita = data.dataVisita;
    if (data.moradoresQtd !== undefined)
      vistoria.moradoresQtd = data.moradoresQtd;
    if (data.gravidas !== undefined) vistoria.gravidas = data.gravidas;
    if (data.idosos !== undefined) vistoria.idosos = data.idosos;
    if (data.criancas7anos !== undefined)
      vistoria.criancas7anos = data.criancas7anos;
    if (data.latChegada !== undefined) vistoria.latChegada = data.latChegada;
    if (data.lngChegada !== undefined) vistoria.lngChegada = data.lngChegada;
    if (data.checkinEm !== undefined) vistoria.checkinEm = data.checkinEm;
    if (data.observacao !== undefined) vistoria.observacao = data.observacao;
    if (data.payload !== undefined) vistoria.payload = data.payload;
    if (data.acessoRealizado !== undefined)
      vistoria.acessoRealizado = data.acessoRealizado;
    if (data.motivoSemAcesso !== undefined)
      vistoria.motivoSemAcesso = data.motivoSemAcesso;
    if (data.proximoHorarioSugerido !== undefined)
      vistoria.proximoHorarioSugerido = data.proximoHorarioSugerido;
    if (data.observacaoAcesso !== undefined)
      vistoria.observacaoAcesso = data.observacaoAcesso;
    if (data.fotoExternaUrl !== undefined)
      vistoria.fotoExternaUrl = data.fotoExternaUrl;
    if (data.origemVisita !== undefined)
      vistoria.origemVisita = data.origemVisita;
    if (data.habitatSelecionado !== undefined)
      vistoria.habitatSelecionado = data.habitatSelecionado;
    if (data.condicaoHabitat !== undefined)
      vistoria.condicaoHabitat = data.condicaoHabitat;
    if (data.assinaturaResponsavelUrl !== undefined)
      vistoria.assinaturaResponsavelUrl = data.assinaturaResponsavelUrl;
    if (data.pendenteAssinatura !== undefined)
      vistoria.pendenteAssinatura = data.pendenteAssinatura;
    if (data.pendenteFoto !== undefined)
      vistoria.pendenteFoto = data.pendenteFoto;
    if (data.origemOffline !== undefined)
      vistoria.origemOffline = data.origemOffline;
    if (data.assinaturaPublicId !== undefined)
      vistoria.assinaturaPublicId = data.assinaturaPublicId;
    if (data.fotoExternaPublicId !== undefined)
      vistoria.fotoExternaPublicId = data.fotoExternaPublicId;
    if (data.idempotencyKey !== undefined)
      vistoria.idempotencyKey = data.idempotencyKey;
    if (data.focoRiscoId !== undefined) {
      vistoria.focoRiscoId = data.focoRiscoId ?? undefined;
    }
    if (data.resultadoOperacional !== undefined)
      vistoria.resultadoOperacional = data.resultadoOperacional;
    if (data.vulnerabilidadeDomiciliar !== undefined)
      vistoria.vulnerabilidadeDomiciliar = data.vulnerabilidadeDomiciliar;
    if (data.alertaSaude !== undefined) vistoria.alertaSaude = data.alertaSaude;
    if (data.riscoSocioambiental !== undefined)
      vistoria.riscoSocioambiental = data.riscoSocioambiental;
    if (data.riscoVetorial !== undefined)
      vistoria.riscoVetorial = data.riscoVetorial;
    if (data.prioridadeFinal !== undefined)
      vistoria.prioridadeFinal = data.prioridadeFinal;
    if (data.prioridadeMotivo !== undefined)
      vistoria.prioridadeMotivo = data.prioridadeMotivo;
    if (data.dimensaoDominante !== undefined)
      vistoria.dimensaoDominante = data.dimensaoDominante;
    if (data.consolidacaoResumo !== undefined)
      vistoria.consolidacaoResumo = data.consolidacaoResumo;
    if (data.consolidacaoJson !== undefined)
      vistoria.consolidacaoJson = data.consolidacaoJson;
    if (data.consolidacaoIncompleta !== undefined)
      vistoria.consolidacaoIncompleta = data.consolidacaoIncompleta;
    if (data.versaoRegraConsolidacao !== undefined)
      vistoria.versaoRegraConsolidacao = data.versaoRegraConsolidacao;
    if (data.versaoPesosConsolidacao !== undefined)
      vistoria.versaoPesosConsolidacao = data.versaoPesosConsolidacao;
    if (data.consolidadoEm !== undefined)
      vistoria.consolidadoEm = data.consolidadoEm;
    if (data.reprocessadoEm !== undefined)
      vistoria.reprocessadoEm = data.reprocessadoEm;
    if (data.reprocessadoPor !== undefined)
      vistoria.reprocessadoPor = data.reprocessadoPor;

    await this.writeRepository.save(vistoria);

    // Paridade com WHEN clause de trg_consolidar_vistoria_update (SQL legado):
    // dispara apenas se 1+ das 6 colunas-input mudou.
    const alteracaoRelevante =
      antes.acessoRealizado !== vistoria.acessoRealizado ||
      antes.status !== vistoria.status ||
      antes.moradoresQtd !== vistoria.moradoresQtd ||
      antes.gravidas !== vistoria.gravidas ||
      antes.idosos !== vistoria.idosos ||
      antes.criancas7anos !== vistoria.criancas7anos;

    if (alteracaoRelevante) {
      try {
        await this.consolidarVistoria.execute({
          vistoriaId: id,
          motivo: 'automático — UPDATE em vistorias',
        });
      } catch (err) {
        this.logger.error(
          `Hook ConsolidarVistoria falhou: vistoriaId=${id} erro=${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // K.4 — fn_atualizar_perfil_imovel: dispara em toda mudança de acessoRealizado
    // Transição false→true pode fazer janela cair e precisar resetar prioridade_drone (branch 3)
    if (vistoria.imovelId && antes.acessoRealizado !== vistoria.acessoRealizado) {
      try {
        await this.atualizarPerfilImovel.execute({
          imovelId: vistoria.imovelId,
          vistoriaId: id,
          agenteId: vistoria.agenteId ?? null,
          clienteId: vistoria.clienteId,
        });
      } catch (err) {
        this.logger.error(
          `[SaveVistoria] Hook AtualizarPerfilImovel falhou para imovel ${vistoria.imovelId}: ${(err as Error).message}`,
        );
      }
    }

    return { vistoria };
  }
}
