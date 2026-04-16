export type FocoStatus =
  | 'suspeita'
  | 'em_triagem'
  | 'aguarda_inspecao'
  | 'em_inspecao'
  | 'confirmado'
  | 'em_tratamento'
  | 'resolvido'
  | 'descartado';

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
    case 'confirmado':
    case 'em_tratamento':
      return 'em_atendimento';

    case 'resolvido':
    case 'descartado':
      return 'resolvido';
  }
}
