/**
 * Port TS de `fn_auto_classificar_foco` (BEFORE INSERT trigger legado).
 * Promove `origem_tipo` em `classificacao_inicial`:
 *   - drone  → 'foco'
 *   - pluvio → 'risco'
 *   - demais → preserva valor explícito (ou 'suspeito' default)
 */
export type ClassificacaoInicial =
  | 'suspeito'
  | 'risco'
  | 'foco'
  | 'caso_notificado';

export function autoClassificarFoco(input: {
  origemTipo: string;
  classificacaoInicial?: string;
}): ClassificacaoInicial {
  switch (input.origemTipo) {
    case 'drone':
      return 'foco';
    case 'pluvio':
      return 'risco';
    default:
      return (input.classificacaoInicial ?? 'suspeito') as ClassificacaoInicial;
  }
}
