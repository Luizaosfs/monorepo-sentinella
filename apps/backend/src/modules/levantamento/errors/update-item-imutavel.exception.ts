import { ForbiddenException } from '@nestjs/common';

/**
 * Paridade com `fn_bloquear_update_campos_tecnicos` (trigger SQL legado).
 *
 * Campos técnicos de `levantamento_itens` são imutáveis após criação — refletem
 * o dado capturado em campo (coordenadas GPS, imagem Cloudinary, score YOLO).
 * Alterações semânticas posteriores devem ir para `focos_risco`, que é a tabela
 * de rastreamento operacional.
 */
export class UpdateItemImutavelException {
  static camposImutaveis(campos: string[]) {
    const lista = campos.join(', ');
    return new ForbiddenException(
      `levantamento_item é imutável após criação. Campo(s) ${lista} não podem ser alterados. ` +
        `Use focos_risco para rastreamento operacional.`,
    );
  }
}
