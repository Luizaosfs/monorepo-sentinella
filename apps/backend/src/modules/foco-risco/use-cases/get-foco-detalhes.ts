import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { FocoRiscoException } from '../errors/foco-risco.exception';

const VISTORIA_INCLUDE = {
  depositos: { where: { deleted_at: null } },
  sintomas:  { where: { deleted_at: null } },
  calhas:    { where: { deleted_at: null } },
  riscos:    { where: { deleted_at: null } },
  agente:    { select: { id: true, nome: true } },
} as const;

@Injectable()
export class GetFocoDetalhes {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, tenantId?: string | null) {
    const foco = await this.prisma.client.focos_risco.findFirst({
      where: {
        id,
        deleted_at: null,
        ...(tenantId ? { cliente_id: tenantId } : {}),
      },
      include: {
        imovel: true,
        responsavel: { select: { id: true, nome: true, email: true } },
      },
    });

    if (!foco) throw FocoRiscoException.notFound();

    // Prefer vistoria directly linked to this foco, then fall back to most recent for the imovel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vistoria: any = null;

    if (foco.origem_vistoria_id) {
      vistoria = await this.prisma.client.vistorias.findFirst({
        where: { id: foco.origem_vistoria_id, deleted_at: null },
        include: VISTORIA_INCLUDE,
      });
    }

    if (!vistoria) {
      vistoria = await this.prisma.client.vistorias.findFirst({
        where: {
          foco_risco_id: foco.id,
          deleted_at: null,
          ...(tenantId ? { cliente_id: tenantId } : { cliente_id: foco.cliente_id }),
        },
        orderBy: { created_at: 'desc' },
        include: VISTORIA_INCLUDE,
      });
    }

    if (!vistoria && foco.imovel_id) {
      vistoria = await this.prisma.client.vistorias.findFirst({
        where: {
          imovel_id: foco.imovel_id,
          cliente_id: foco.cliente_id,
          deleted_at: null,
        },
        orderBy: { created_at: 'desc' },
        include: VISTORIA_INCLUDE,
      });
    }

    return {
      foco: {
        id: foco.id,
        clienteId: foco.cliente_id,
        imovelId: foco.imovel_id,
        regiaoId: foco.regiao_id,
        codigoFoco: foco.codigo_foco,
        status: foco.status,
        prioridade: foco.prioridade,
        scorePrioridade: foco.score_prioridade,
        classificacaoInicial: foco.classificacao_inicial,
        origemTipo: foco.origem_tipo,
        enderecoNormalizado: foco.endereco_normalizado,
        latitude: foco.latitude,
        longitude: foco.longitude,
        suspeitaEm: foco.suspeita_em,
        confirmadoEm: foco.confirmado_em,
        inspecaoEm: foco.inspecao_em,
        resolvidoEm: foco.resolvido_em,
        desfecho: foco.desfecho,
        observacao: foco.observacao,
        casosIds: foco.casos_ids ?? [],
        ciclo: foco.ciclo,
        createdAt: foco.created_at,
        responsavel: foco.responsavel
          ? { id: foco.responsavel.id, nome: foco.responsavel.nome, email: foco.responsavel.email }
          : null,
      },
      imovel: foco.imovel
        ? {
            id: foco.imovel.id,
            tipoImovel: foco.imovel.tipo_imovel,
            logradouro: foco.imovel.logradouro,
            numero: foco.imovel.numero,
            complemento: foco.imovel.complemento,
            bairro: foco.imovel.bairro,
            quarteirao: foco.imovel.quarteirao,
            latitude: foco.imovel.latitude,
            longitude: foco.imovel.longitude,
            proprietarioAusente: foco.imovel.proprietario_ausente,
            temCalha: foco.imovel.tem_calha,
            calhaAcessivel: foco.imovel.calha_acessivel,
            temAnimalAgressivo: foco.imovel.tem_animal_agressivo,
            historicoRecusa: foco.imovel.historico_recusa,
          }
        : null,
      vistoria: vistoria
        ? {
            id: vistoria.id,
            dataVisita: vistoria.data_visita,
            moradoresQtd: vistoria.moradores_qtd,
            gravidas: vistoria.gravidas,
            idosos: vistoria.idosos,
            criancas7anos: vistoria.criancas_7anos,
            payload: vistoria.payload as Record<string, unknown> | null,
            tipoAtividade: vistoria.tipo_atividade,
            resultadoOperacional: vistoria.resultado_operacional,
            vulnerabilidadeDomiciliar: vistoria.vulnerabilidade_domiciliar,
            alertaSaude: vistoria.alerta_saude,
            riscoSocioambiental: vistoria.risco_socioambiental,
            riscoVetorial: vistoria.risco_vetorial,
            prioridadeFinal: vistoria.prioridade_final,
            prioridadeMotivo: vistoria.prioridade_motivo,
            dimensaoDominante: vistoria.dimensao_dominante,
            consolidacaoResumo: vistoria.consolidacao_resumo,
            acessoRealizado: vistoria.acesso_realizado,
            motivoSemAcesso: vistoria.motivo_sem_acesso,
            fotoExternaUrl: vistoria.foto_externa_url,
            agente: vistoria.agente ? { id: vistoria.agente.id, nome: vistoria.agente.nome } : null,
            depositos: vistoria.depositos?.map((d: any) => ({
              id: d.id,
              tipo: d.tipo,
              qtdInspecionados: d.qtd_inspecionados,
              qtdComFocos: d.qtd_com_focos,
              qtdEliminados: d.qtd_eliminados,
              qtdComAgua: d.qtd_com_agua,
              usouLarvicida: d.usou_larvicida,
              qtdLarvicidaG: d.qtd_larvicida_g,
              eliminado: d.eliminado,
              vedado: d.vedado,
              iaIdentificacao: d.ia_identificacao as Record<string, unknown> | null,
            })) ?? [],
            sintomas: vistoria.sintomas?.map((s: any) => ({
              id: s.id,
              febre: s.febre,
              manchasVermelhas: s.manchas_vermelhas,
              dorArticulacoes: s.dor_articulacoes,
              dorCabeca: s.dor_cabeca,
              nausea: s.nausea,
              moradoresSintomasQtd: s.moradores_sintomas_qtd,
            })) ?? [],
            calhas: vistoria.calhas?.map((c: any) => ({
              id: c.id,
              posicao: c.posicao,
              condicao: c.condicao,
              comFoco: c.com_foco,
              acessivel: c.acessivel,
              tratamentoRealizado: c.tratamento_realizado,
              fotoUrl: c.foto_url,
              observacao: c.observacao,
            })) ?? [],
            riscos: vistoria.riscos?.map((r: any) => ({
              id: r.id,
              menorIncapaz: r.menor_incapaz,
              idosoIncapaz: r.idoso_incapaz,
              mobilidadeReduzida: r.mobilidade_reduzida,
              acamado: r.acamado,
              depQuimico: r.dep_quimico,
              riscoAlimentar: r.risco_alimentar,
              riscoMoradia: r.risco_moradia,
              criadouroAnimais: r.criadouro_animais,
              lixo: r.lixo,
              residuosOrganicos: r.residuos_organicos,
              residuosQuimicos: r.residuos_quimicos,
              residuosMedicos: r.residuos_medicos,
              acumuloMaterialOrganico: r.acumulo_material_organico,
              animaisSinaisLv: r.animais_sinais_lv,
              caixaDestampada: r.caixa_destampada,
              outroRiscoVetorial: r.outro_risco_vetorial,
            })) ?? [],
          }
        : null,
      casosCount: foco.casos_ids?.length ?? 0,
    };
  }
}
