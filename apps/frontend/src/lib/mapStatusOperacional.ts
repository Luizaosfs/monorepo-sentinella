export type FocoStatus =
  | 'suspeita'
  | 'em_triagem'
  | 'aguarda_inspecao'
  | 'em_inspecao'
  | 'aguardando_nova_tentativa'
  | 'confirmado'
  | 'em_tratamento'
  | 'resolvido'
  | 'descartado'
  | 'encaminhado_administrativo'
  | 'acionado_juridico';

export type StatusOperacional =
  | 'pendente'
  | 'em_atendimento'
  | 'resolvido';

export const LABEL_STATUS_OPERACIONAL: Record<StatusOperacional, string> = {
  pendente: 'Pendente',
  em_atendimento: 'Em atendimento',
  resolvido: 'Resolvido',
};

export function mapFocoToStatusOperacional(
  status: FocoStatus
): StatusOperacional {
  switch (status) {
    case 'suspeita':
    case 'em_triagem':
    case 'aguarda_inspecao':
      return 'pendente';

    case 'em_inspecao':
    case 'aguardando_nova_tentativa':
    case 'confirmado':
    case 'em_tratamento':
      return 'em_atendimento';

    case 'resolvido':
    case 'descartado':
    case 'encaminhado_administrativo':
    case 'acionado_juridico':
      return 'resolvido';
  }
}
