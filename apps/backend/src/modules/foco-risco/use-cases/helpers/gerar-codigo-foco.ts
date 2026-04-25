import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

/**
 * Gera código de foco no formato YYYY-NNNNNNNN, atômico via INSERT … ON CONFLICT DO UPDATE.
 * Paridade com fn_gerar_codigo_foco (SQL legado). Sequência por (cliente_id, ano).
 *
 * @param prisma instância do PrismaService
 * @param clienteId UUID do cliente (tenant)
 * @param data data de referência para extrair o ano (default: agora). Use suspeitaEm quando disponível.
 */
export async function gerarCodigoFoco(
  prisma: PrismaService,
  clienteId: string,
  data: Date = new Date(),
): Promise<string> {
  const ano = data.getUTCFullYear();

  const result = await prisma.client.$queryRaw<{ ultimo: bigint }[]>`
    INSERT INTO foco_sequencia (cliente_id, ano, ultimo)
    VALUES (${clienteId}::uuid, ${ano}, 1)
    ON CONFLICT (cliente_id, ano) DO UPDATE
      SET ultimo = foco_sequencia.ultimo + 1
    RETURNING ultimo
  `;

  const seq = Number(result[0].ultimo);
  return `${ano}-${seq.toString().padStart(8, '0')}`;
}
