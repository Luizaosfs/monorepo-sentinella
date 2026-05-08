import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { BulkInsertQuarteiraoInput } from '../dtos/bulk-insert-quarteiroes.body';

@Injectable()
export class BulkInsertQuarteiroes {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    input: BulkInsertQuarteiraoInput,
  ): Promise<{ inserted: number; updated: number }> {
    if (input.rows.length === 0) return { inserted: 0, updated: 0 };

    // Resolve nome do bairro → regiao_id
    const regioes = await this.prisma.client.regioes.findMany({
      where: { cliente_id: clienteId, deleted_at: null },
      select: { id: true, nome: true },
    });
    const regiaoByNome = new Map(
      regioes.map(r => [r.nome.toLowerCase().trim(), r.id]),
    );

    const resolveRegiaoId = (r: { regiaoId?: string; bairro?: string }) =>
      r.regiaoId ?? (r.bairro ? (regiaoByNome.get(r.bairro.toLowerCase().trim()) ?? null) : null);

    // Verifica quais códigos já existem
    const codigos = input.rows.map(r => r.codigo);
    const existing = await this.prisma.client.quarteiroes.findMany({
      where: { cliente_id: clienteId, codigo: { in: codigos } },
      select: { id: true, codigo: true },
    });
    const existingMap = new Map(existing.map(e => [e.codigo, e.id]));

    const toInsert = input.rows.filter(r => !existingMap.has(r.codigo));
    const toUpdate = input.rows.filter(r => existingMap.has(r.codigo));

    let inserted = 0;
    let updated = 0;

    // Atualiza existentes (regiao_id, bairro, ativo)
    for (const r of toUpdate) {
      const regiaoId = resolveRegiaoId(r);
      await this.prisma.client.quarteiroes.update({
        where: { id: existingMap.get(r.codigo)! },
        data: {
          ...(regiaoId              !== null      ? { regiao_id: regiaoId }  : {}),
          ...(r.bairro              !== undefined ? { bairro: r.bairro }     : {}),
          ...(r.ativo               !== undefined ? { ativo: r.ativo }       : {}),
        },
      });
      updated++;
    }

    // Insere novos em lote
    if (toInsert.length > 0) {
      const result = await this.prisma.client.quarteiroes.createMany({
        data: toInsert.map(r => ({
          cliente_id: clienteId,
          codigo:     r.codigo,
          regiao_id:  resolveRegiaoId(r),
          bairro:     r.bairro ?? null,
          ativo:      r.ativo ?? true,
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    return { inserted, updated };
  }
}
