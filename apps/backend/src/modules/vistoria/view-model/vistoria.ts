import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  Vistoria,
  VistoriaCalha,
  VistoriaDeposito,
  VistoriaRisco,
  VistoriaSintoma,
} from '../entities/vistoria';

export class VistoriaViewModel {
  static depositoToHttp(dep: VistoriaDeposito) {
    return {
      id: dep.id,
      tipoDeposito: dep.tipoDeposito,
      quantidade: dep.quantidade,
      qtdComAgua: dep.qtdComAgua,
      qtdComFocos: dep.qtdComFocos,
      qtdEliminados: dep.qtdEliminados,
      usouLarvicida: dep.usouLarvicida,
      qtdLarvicidaG: dep.qtdLarvicidaG,
      comLarva: dep.comLarva,
      eliminado: dep.eliminado,
      vedado: dep.vedado,
      createdAt: dep.createdAt,
    };
  }

  static sintomaToHttp(sint: VistoriaSintoma) {
    return {
      id: sint.id,
      febre: sint.febre,
      manchasVermelhas: sint.manchasVermelhas,
      dorArticulacoes: sint.dorArticulacoes,
      dorCabeca: sint.dorCabeca,
      nausea: sint.nausea,
      moradoresSintomasQtd: sint.moradoresSintomasQtd,
      createdAt: sint.createdAt,
    };
  }

  static riscoToHttp(risco: VistoriaRisco) {
    return {
      id: risco.id,
      menorIncapaz: risco.menorIncapaz,
      idosoIncapaz: risco.idosoIncapaz,
      mobilidadeReduzida: risco.mobilidadeReduzida,
      acamado: risco.acamado,
      depQuimico: risco.depQuimico,
      riscoAlimentar: risco.riscoAlimentar,
      riscoMoradia: risco.riscoMoradia,
      criadouroAnimais: risco.criadouroAnimais,
      lixo: risco.lixo,
      residuosOrganicos: risco.residuosOrganicos,
      residuosQuimicos: risco.residuosQuimicos,
      residuosMedicos: risco.residuosMedicos,
      acumuloMaterialOrganico: risco.acumuloMaterialOrganico,
      animaisSinaisLv: risco.animaisSinaisLv,
      caixaDestampada: risco.caixaDestampada,
      outroRiscoVetorial: risco.outroRiscoVetorial,
      createdAt: risco.createdAt,
    };
  }

  static calhaToHttp(calha: VistoriaCalha) {
    return {
      id: calha.id,
      posicao: calha.posicao,
      condicao: calha.condicao,
      comFoco: calha.comFoco,
      acessivel: calha.acessivel,
      tratamentoRealizado: calha.tratamentoRealizado,
      observacao: calha.observacao,
      createdAt: calha.createdAt,
    };
  }

  static toHttp(vistoria: Vistoria) {
    return {
      id: vistoria.id,
      clienteId: vistoria.clienteId,
      imovelId: vistoria.imovelId,
      agenteId: vistoria.agenteId,
      planejamentoId: vistoria.planejamentoId,
      ciclo: vistoria.ciclo,
      tipoAtividade: vistoria.tipoAtividade,
      dataVisita: vistoria.dataVisita,
      status: vistoria.status,
      moradoresQtd: vistoria.moradoresQtd,
      gravidas: vistoria.gravidas,
      idosos: vistoria.idosos,
      criancas7anos: vistoria.criancas7anos,
      latChegada: vistoria.latChegada,
      lngChegada: vistoria.lngChegada,
      checkinEm: vistoria.checkinEm,
      observacao: vistoria.observacao,
      payload: vistoria.payload,
      acessoRealizado: vistoria.acessoRealizado,
      motivoSemAcesso: vistoria.motivoSemAcesso,
      proximoHorarioSugerido: vistoria.proximoHorarioSugerido,
      observacaoAcesso: vistoria.observacaoAcesso,
      fotoExternaUrl: vistoria.fotoExternaUrl,
      origemVisita: vistoria.origemVisita,
      habitatSelecionado: vistoria.habitatSelecionado,
      condicaoHabitat: vistoria.condicaoHabitat,
      assinaturaResponsavelUrl: vistoria.assinaturaResponsavelUrl,
      pendenteAssinatura: vistoria.pendenteAssinatura,
      pendenteFoto: vistoria.pendenteFoto,
      origemOffline: vistoria.origemOffline,
      assinaturaPublicId: vistoria.assinaturaPublicId,
      fotoExternaPublicId: vistoria.fotoExternaPublicId,
      idempotencyKey: vistoria.idempotencyKey,
      focoRiscoId: vistoria.focoRiscoId,
      resultadoOperacional: vistoria.resultadoOperacional,
      vulnerabilidadeDomiciliar: vistoria.vulnerabilidadeDomiciliar,
      alertaSaude: vistoria.alertaSaude,
      riscoSocioambiental: vistoria.riscoSocioambiental,
      riscoVetorial: vistoria.riscoVetorial,
      prioridadeFinal: vistoria.prioridadeFinal,
      prioridadeMotivo: vistoria.prioridadeMotivo,
      dimensaoDominante: vistoria.dimensaoDominante,
      consolidacaoResumo: vistoria.consolidacaoResumo,
      consolidacaoJson: vistoria.consolidacaoJson,
      consolidacaoIncompleta: vistoria.consolidacaoIncompleta,
      versaoRegraConsolidacao: vistoria.versaoRegraConsolidacao,
      versaoPesosConsolidacao: vistoria.versaoPesosConsolidacao,
      consolidadoEm: vistoria.consolidadoEm,
      reprocessadoEm: vistoria.reprocessadoEm,
      reprocessadoPor: vistoria.reprocessadoPor,
      depositos: vistoria.depositos?.map(VistoriaViewModel.depositoToHttp),
      sintomas: vistoria.sintomas?.map(VistoriaViewModel.sintomaToHttp),
      riscos: vistoria.riscos?.map(VistoriaViewModel.riscoToHttp),
      calhas: vistoria.calhas?.map(VistoriaViewModel.calhaToHttp),
      agente: vistoria.agente,
      imovel: vistoria.imovel,
      createdAt: vistoria.createdAt,
      updatedAt: vistoria.updatedAt,
      ...baseAuditToHttp(vistoria),
    };
  }
}
