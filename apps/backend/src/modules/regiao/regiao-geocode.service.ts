import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable()
export class RegiaoGeocodeService {
  private readonly logger = new Logger(RegiaoGeocodeService.name);

  async geocodeRegioes(clienteId: string): Promise<{ total: number; geocodificadas: number }> {
    const regioes = await this.prisma.client.regioes.findMany({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        latitude: null,
      },
      select: { id: true, nome: true, municipio: true, uf: true },
    });

    let geocodificadas = 0;

    for (const regiao of regioes) {
      try {
        const query = [regiao.nome, regiao.municipio, regiao.uf, 'Brasil']
          .filter(Boolean)
          .join(', ');

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Sentinella/1.0 (suporte@sentinella.com.br)' },
        });

        if (!res.ok) continue;
        const results: NominatimResult[] = (await res.json()) as NominatimResult[];
        if (results.length === 0) continue;

        const { lat, lon } = results[0];

        await this.prisma.client.regioes.update({
          where: { id: regiao.id },
          data: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            updated_at: new Date(),
          },
        });

        geocodificadas++;
        // Respeita rate-limit Nominatim: 1 req/s
        await new Promise((r) => setTimeout(r, 1100));
      } catch (err: any) {
        this.logger.warn(`[geocodeRegioes] Falha regiao ${regiao.id}: ${err?.message}`);
      }
    }

    this.logger.log(
      `[RegiaoGeocodeService.geocodeRegioes] total=${regioes.length} geocodificadas=${geocodificadas}`,
    );
    return { total: regioes.length, geocodificadas };
  }

  async geocodeLote(
    nomes: string[],
    cidade: string,
  ): Promise<{ results: { nome: string; latitude: number | null; longitude: number | null }[] }> {
    const results: { nome: string; latitude: number | null; longitude: number | null }[] = [];

    for (const nome of nomes) {
      try {
        const query = [nome, cidade, 'Brasil'].filter(Boolean).join(', ');
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Sentinella/1.0 (suporte@sentinella.com.br)' },
        });

        if (!res.ok) { results.push({ nome, latitude: null, longitude: null }); continue; }
        const rows: NominatimResult[] = (await res.json()) as NominatimResult[];
        if (rows.length === 0) { results.push({ nome, latitude: null, longitude: null }); continue; }

        results.push({ nome, latitude: parseFloat(rows[0].lat), longitude: parseFloat(rows[0].lon) });
        await new Promise((r) => setTimeout(r, 1100));
      } catch (err: unknown) {
        this.logger.warn(`[geocodeLote] Falha para "${nome}": ${(err as Error)?.message}`);
        results.push({ nome, latitude: null, longitude: null });
      }
    }

    return { results };
  }

  constructor(private prisma: PrismaService) {}
}
