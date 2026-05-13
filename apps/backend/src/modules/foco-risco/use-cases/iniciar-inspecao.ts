import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import type { AuthenticatedUser } from 'src/guards/auth.guard';
import { EnsureAgentePodeAtuarNaQuadra } from 'src/modules/quarteirao/use-cases/ensure-agente-pode-atuar-na-quadra';

import { IniciarInspecaoInput } from '../dtos/iniciar-inspecao.body';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class IniciarInspecao {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    private ensureAgentePodeAtuar: EnsureAgentePodeAtuarNaQuadra,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: IniciarInspecaoInput) {
    const user = this.req['user'] as AuthenticatedUser | undefined;

    // G2: AuthGuard já filtra usuário inativo (lança 401 antes de chegar aqui).
    // Defense-in-depth: ausência de user equivale a "não autenticado / inativo".
    if (!user) throw FocoRiscoException.usuarioInativo();

    // G1: papel NULL — usuário sem entrada em papeis_usuarios.
    if (!user.papeis || user.papeis.length === 0) {
      throw FocoRiscoException.papelNaoDefinido();
    }

    // G3: legado é estrito — apenas papel canônico 'agente' inicia.
    // Admin NÃO bypassa (paridade fiel com fn_iniciar_inspecao_foco hardening_final).
    if (!user.papeis.includes('agente')) {
      throw FocoRiscoException.apenasAgenteInicia();
    }

    const tenantId = getAccessScope(this.req).tenantId;
    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    // G4: idempotência — foco já em inspeção retorna ok sem alterar.
    if (foco.status === 'em_inspecao') {
      return { foco, jaEmInspecao: true };
    }

    // G7: verificação territorial — agente só atua em quadras atribuídas a ele.
    // Resolve quadra via imovel_id (campo de domínio) ou quadra_id direto (focos de drone/Python).
    // Sem nenhum dos dois: foco sem território definido → bloquear até que o supervisor vincule.
    if (foco.quadraId) {
      await this.ensureAgentePodeAtuar.executeByQuadraId(tenantId!, user.id, foco.quadraId);
    } else if (foco.imovelId) {
      await this.ensureAgentePodeAtuar.execute(tenantId!, user.id, foco.imovelId);
    } else {
      throw FocoRiscoException.semTerritorioParaVerificacao();
    }

    if (foco.status !== 'aguarda_inspecao' && foco.status !== 'aguardando_nova_tentativa') {
      throw FocoRiscoException.statusInvalido();
    }

    if (foco.status === 'aguardando_nova_tentativa' && foco.pendentDecisaoSupervisor) {
      throw FocoRiscoException.aguardaDecisaoSupervisor();
    }

    const statusAnterior = foco.status;
    foco.status = 'em_inspecao';
    // G6: COALESCE — preservar valores existentes.
    foco.responsavelId = foco.responsavelId ?? user.id;
    foco.inspecaoEm = foco.inspecaoEm ?? new Date();
    if (input.observacao) foco.observacao = input.observacao;

    await this.writeRepository.save(foco);

    await this.writeRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: statusAnterior,
      statusNovo: 'em_inspecao',
      alteradoPor: user.id,
      motivo: input.observacao,
      // G5: tipo_evento canônico (paridade com fn_registrar_historico_foco).
      tipoEvento: 'inspecao_iniciada',
    });

    return { foco, jaEmInspecao: false };
  }

}
