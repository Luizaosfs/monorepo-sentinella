import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';
import { gerarCodigoFoco } from '../helpers/gerar-codigo-foco';
import { autoClassificarFoco } from './auto-classificar-foco';

export interface CriarFocoDeVistoriaDepositoInput {
  vistoriaId: string;
  qtdComFocos: number | null | undefined;
}

export interface CriarFocoDeVistoriaDepositoResult {
  criado: boolean;
  focoId?: string;
  motivo?:
    | 'deposito_sem_foco'
    | 'vistoria_nao_encontrada'
    | 'vistoria_ja_vinculada';
}

@Injectable()
export class CriarFocoDeVistoriaDeposito {
  private readonly logger = new Logger(CriarFocoDeVistoriaDeposito.name);

  constructor(
    private prisma: PrismaService,
    private cruzarFocoNovoComCasos: CruzarFocoNovoComCasos,
  ) {}

  async execute(
    input: CriarFocoDeVistoriaDepositoInput,
  ): Promise<CriarFocoDeVistoriaDepositoResult> {
    if (!input.qtdComFocos || input.qtdComFocos <= 0) {
      return { criado: false, motivo: 'deposito_sem_foco' };
    }

    const vistoria = await this.prisma.client.vistorias.findUnique({
      where: { id: input.vistoriaId },
      select: {
        cliente_id: true,
        imovel_id: true,
        ciclo: true,
        foco_risco_id: true,
      },
    });

    if (!vistoria) {
      return { criado: false, motivo: 'vistoria_nao_encontrada' };
    }

    if (vistoria.foco_risco_id) {
      return { criado: false, motivo: 'vistoria_ja_vinculada' };
    }

    let regiaoId: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let enderecoNormalizado: string | null = null;

    if (vistoria.imovel_id) {
      const imovel = await this.prisma.client.imoveis.findUnique({
        where: { id: vistoria.imovel_id },
        select: {
          regiao_id: true,
          latitude: true,
          longitude: true,
          logradouro: true,
          numero: true,
        },
      });

      if (imovel) {
        regiaoId = imovel.regiao_id;
        latitude = imovel.latitude;
        longitude = imovel.longitude;
        const logradouro = imovel.logradouro ?? '';
        const numero = imovel.numero ?? 'S/N';
        const composed = `${logradouro}, ${numero}`.trim();
        enderecoNormalizado =
          composed === ',' || composed === ', S/N' || composed === 'S/N'
            ? null
            : composed;
      }
    }

    const classificacaoInicial = autoClassificarFoco({ origemTipo: 'agente' });
    const codigoFoco = await gerarCodigoFoco(this.prisma, vistoria.cliente_id);

    const foco = await this.prisma.client.focos_risco.create({
      data: {
        cliente_id: vistoria.cliente_id,
        imovel_id: vistoria.imovel_id,
        regiao_id: regiaoId,
        origem_tipo: 'agente',
        origem_vistoria_id: input.vistoriaId,
        status: 'em_triagem',
        classificacao_inicial: classificacaoInicial,
        ciclo: vistoria.ciclo,
        latitude,
        longitude,
        endereco_normalizado: enderecoNormalizado,
        codigo_foco: codigoFoco,
      },
    });

    this.logger.log(
      `Foco auto-criado de vistoria_deposito: vistoria=${input.vistoriaId} foco=${foco.id} imovel=${vistoria.imovel_id ?? 'null'}`,
    );

    try {
      await this.cruzarFocoNovoComCasos.execute({
        focoId: foco.id,
        clienteId: foco.cliente_id,
        origemLevantamentoItemId: foco.origem_levantamento_item_id ?? null,
        latitude: foco.latitude,
        longitude: foco.longitude,
      });
    } catch (err) {
      this.logger.error(
        `Hook CruzarFocoNovoComCasos falhou: foco=${foco.id} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { criado: true, focoId: foco.id };
  }
}
