import { Controller, Get, HttpException, HttpStatus, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public, SkipTenant } from '@/decorators/roles.decorator';

const TILE_SOURCES: Record<string, string> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile',
  terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile',
};

@ApiTags('Tiles')
@Controller('tiles')
export class TilesController {
  @Get(':service/:z/:y/:x')
  @Public()
  @SkipTenant()
  @SkipThrottle()
  @ApiOperation({ summary: 'Proxy de tiles de mapa (Esri World Imagery / Topo)' })
  async getTile(
    @Param('service') service: string,
    @Param('z') z: string,
    @Param('y') y: string,
    @Param('x') x: string,
    @Res() res: Response,
  ): Promise<void> {
    const base = TILE_SOURCES[service];
    if (!base) throw new HttpException('Serviço inválido', HttpStatus.NOT_FOUND);

    const zn = Number(z);
    const yn = Number(y);
    const xn = Number(x);
    if (!Number.isInteger(zn) || !Number.isInteger(yn) || !Number.isInteger(xn)
      || zn < 0 || zn > 22 || yn < 0 || xn < 0) {
      throw new HttpException('Parâmetros inválidos', HttpStatus.BAD_REQUEST);
    }

    try {
      const upstream = await fetch(`${base}/${zn}/${yn}/${xn}`, {
        headers: { 'User-Agent': 'SentinellaWeb/1.0 tile-proxy' },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) {
        throw new HttpException('Tile não encontrado', HttpStatus.NOT_FOUND);
      }
      const buffer = await upstream.arrayBuffer();
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(Buffer.from(buffer));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Erro ao buscar tile', HttpStatus.BAD_GATEWAY);
    }
  }
}
