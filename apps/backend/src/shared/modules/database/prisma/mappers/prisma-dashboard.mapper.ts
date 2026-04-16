import {
  RelatorioGerado,
  ResumoDiario,
  SystemAlert,
  SystemHealthLog,
} from 'src/modules/dashboard/entities/dashboard';

export class PrismaDashboardMapper {
  static resumoToDomain(raw: any): ResumoDiario {
    return new ResumoDiario(
      {
        clienteId: raw.cliente_id,
        dataRef: raw.data_ref,
        sumario: raw.sumario,
        metricas: raw.metricas ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at },
    );
  }

  static relatorioToDomain(raw: any): RelatorioGerado {
    return new RelatorioGerado(
      {
        clienteId: raw.cliente_id,
        geradoPor: raw.gerado_por ?? undefined,
        periodoInicio: raw.periodo_inicio,
        periodoFim: raw.periodo_fim,
        payload: raw.payload,
      },
      { id: raw.id, createdAt: raw.created_at },
    );
  }

  static relatorioToPrisma(entity: RelatorioGerado) {
    return {
      cliente_id: entity.clienteId,
      gerado_por: entity.geradoPor ?? null,
      periodo_inicio: entity.periodoInicio,
      periodo_fim: entity.periodoFim,
      payload: entity.payload,
    };
  }

  static healthToDomain(raw: any): SystemHealthLog {
    return new SystemHealthLog(
      {
        servico: raw.servico,
        status: raw.status,
        detalhes: raw.detalhes ?? undefined,
        criadoEm: raw.criado_em,
      },
      { id: raw.id },
    );
  }

  static alertToDomain(raw: any): SystemAlert {
    return new SystemAlert(
      {
        servico: raw.servico,
        nivel: raw.nivel,
        mensagem: raw.mensagem,
        resolvido: raw.resolvido,
        resolvidoEm: raw.resolvido_em ?? undefined,
        criadoEm: raw.criado_em,
      },
      { id: raw.id },
    );
  }
}
