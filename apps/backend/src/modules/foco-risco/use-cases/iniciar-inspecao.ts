import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { IniciarInspecaoInput } from '../dtos/iniciar-inspecao.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class IniciarInspecao {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
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

    const foco = await this.readRepository.findById(id);
    if (!foco) throw FocoRiscoException.notFound();

    this.assertFocoDoTenant(foco);

    // G4: idempotência — foco já em inspeção retorna ok sem alterar.
    if (foco.status === 'em_inspecao') {
      return { foco, jaEmInspecao: true };
    }

    if (foco.status !== 'aguarda_inspecao') {
      throw FocoRiscoException.statusInvalido();
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

  private assertFocoDoTenant(foco: FocoRisco) {
    // Paridade fn_iniciar_inspecao_foco: só agente do tenant atual inicia.
    // Admin não bypassa (já bloqueado em G3) — tenant check é estrito.
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId || foco.clienteId !== tenantId) {
      throw FocoRiscoException.notFound();
    }
  }
}
