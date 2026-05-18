import { Injectable } from '@nestjs/common';

import { CruzarFocoConfirmadoComCasos } from './cruzar-foco-confirmado-com-casos';

/**
 * E.1.2 — Adaptador legado.
 *
 * `CruzarFocoNovoComCasos` foi o porte do trigger `fn_cruzar_foco_novo_com_casos`.
 * O SQL original era **incompatível com o schema atual** (verificado no dump live
 * 2026-05-14): inseria em `caso_foco_cruzamento` sem `foco_risco_id` (coluna
 * NOT NULL) e usava `ON CONFLICT (caso_id, levantamento_item_id)` cujo índice
 * único foi removido pela migração E.1.1. Toda invocação lançava exceção —
 * silenciada pelos try/catch best-effort dos callers — e o cruzamento
 * foco → caso nunca acontecia em produção.
 *
 * Em vez de manter dois caminhos divergentes para a mesma regra, este use-case
 * agora **delega** ao canônico `CruzarFocoConfirmadoComCasos`, que escreve
 * `foco_risco_id` e usa a unique key real `(caso_id, foco_risco_id)`. A guarda
 * legada de `origem_levantamento_item_id` deixou de existir — focos sem
 * levantamento (denúncia cidadã, depósito) também cruzam corretamente.
 *
 * A interface de entrada foi preservada para não impactar os callers existentes
 * (`CreateFocoRisco`, `CriarFocoDeLevantamentoItem`, `CriarFocoDeVistoriaDeposito`).
 */
export interface CruzarFocoNovoComCasosInput {
  focoId: string | undefined;
  clienteId: string;
  origemLevantamentoItemId: string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

@Injectable()
export class CruzarFocoNovoComCasos {
  constructor(private cruzarFocoConfirmado: CruzarFocoConfirmadoComCasos) {}

  async execute(
    input: CruzarFocoNovoComCasosInput,
  ): Promise<{ cruzamentos: number }> {
    const { cruzamentos } = await this.cruzarFocoConfirmado.execute({
      focoId: input.focoId,
      clienteId: input.clienteId,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    return { cruzamentos };
  }
}
