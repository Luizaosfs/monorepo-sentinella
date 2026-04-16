import { getTransicoesPermitidas } from '@/types/database';
import type { FocoRiscoStatus } from '@/types/database';

export { getTransicoesPermitidas };

export function podeTransicionar(de: FocoRiscoStatus, para: FocoRiscoStatus): boolean {
  return getTransicoesPermitidas(de).includes(para);
}
