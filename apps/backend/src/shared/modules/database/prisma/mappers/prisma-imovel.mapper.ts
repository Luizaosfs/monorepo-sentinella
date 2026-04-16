import { Imovel } from 'src/modules/imovel/entities/imovel';

type RawImovel = {
  id: string;
  cliente_id: string;
  regiao_id: string | null;
  tipo_imovel: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  quarteirao: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  proprietario_ausente: boolean;
  tipo_ausencia: string | null;
  contato_proprietario: string | null;
  tem_animal_agressivo: boolean;
  historico_recusa: boolean;
  tem_calha: boolean;
  calha_acessivel: boolean;
  prioridade_drone: boolean;
  notificacao_formal_em: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
};

export class PrismaImovelMapper {
  static toDomain(raw: RawImovel): Imovel {
    return new Imovel(
      {
        clienteId: raw.cliente_id,
        regiaoId: raw.regiao_id || undefined,
        tipoImovel: raw.tipo_imovel,
        logradouro: raw.logradouro || undefined,
        numero: raw.numero || undefined,
        complemento: raw.complemento || undefined,
        bairro: raw.bairro || undefined,
        quarteirao: raw.quarteirao || undefined,
        latitude: raw.latitude || undefined,
        longitude: raw.longitude || undefined,
        ativo: raw.ativo,
        proprietarioAusente: raw.proprietario_ausente,
        tipoAusencia: raw.tipo_ausencia || undefined,
        contatoProprietario: raw.contato_proprietario || undefined,
        temAnimalAgressivo: raw.tem_animal_agressivo,
        historicoRecusa: raw.historico_recusa,
        temCalha: raw.tem_calha,
        calhaAcessivel: raw.calha_acessivel,
        prioridadeDrone: raw.prioridade_drone,
        notificacaoFormalEm: raw.notificacao_formal_em || undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at || undefined,
      },
    );
  }

  static toPrisma(entity: Imovel) {
    return {
      cliente_id: entity.clienteId,
      regiao_id: entity.regiaoId || null,
      tipo_imovel: entity.tipoImovel,
      logradouro: entity.logradouro || null,
      numero: entity.numero || null,
      complemento: entity.complemento || null,
      bairro: entity.bairro || null,
      quarteirao: entity.quarteirao || null,
      latitude: entity.latitude || null,
      longitude: entity.longitude || null,
      ativo: entity.ativo,
      proprietario_ausente: entity.proprietarioAusente,
      tipo_ausencia: entity.tipoAusencia || null,
      contato_proprietario: entity.contatoProprietario || null,
      tem_animal_agressivo: entity.temAnimalAgressivo,
      historico_recusa: entity.historicoRecusa,
      tem_calha: entity.temCalha,
      calha_acessivel: entity.calhaAcessivel,
      prioridade_drone: entity.prioridadeDrone,
      notificacao_formal_em: entity.notificacaoFormalEm || null,
      updated_at: new Date(),
    };
  }
}
