import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CoberturaCicloInput,
  coberturaCicloSchema,
} from './dtos/cobertura-ciclo.input';
import {
  CopiarDistribuicaoBody,
  CreateDistribuicaoBody,
  copiarDistribuicaoSchema,
  createDistribuicaoSchema,
} from './dtos/create-distribuicao.body';
import {
  CreateQuarteiraoBody,
  createQuarteiraoSchema,
} from './dtos/create-quarteirao.body';
import {
  FilterDistribuicaoInput,
  filterDistribuicaoSchema,
} from './dtos/filter-distribuicao.input';
import {
  FilterQuarteiraoInput,
  filterQuarteiraoSchema,
} from './dtos/filter-quarteirao.input';
import { CoberturaCiclo } from './use-cases/cobertura-ciclo';
import { CopiarDistribuicao } from './use-cases/copiar-distribuicao';
import { CreateDistribuicao } from './use-cases/create-distribuicao';
import { CreateQuarteirao } from './use-cases/create-quarteirao';
import { DeleteDistribuicao } from './use-cases/delete-distribuicao';
import { DeleteQuarteirao } from './use-cases/delete-quarteirao';
import { FilterDistribuicoes } from './use-cases/filter-distribuicoes';
import { FilterQuarteiroes } from './use-cases/filter-quarteiroes';
import { ListDistribuicoesByAgente } from './use-cases/list-distribuicoes-by-agente';
import { UpsertDistribuicoes } from './use-cases/upsert-distribuicoes';
import { DeletarDistribuicoes } from './use-cases/deletar-distribuicoes';
import {
  UpsertDistribuicoesBody,
  upsertDistribuicoesSchema,
} from './dtos/upsert-distribuicoes.body';
import {
  DeletarDistribuicoesBody,
  deletarDistribuicoesSchema,
} from './dtos/deletar-distribuicoes.body';
import {
  DistribuicaoQuarteiraoViewModel,
  QuarteiraoViewModel,
} from './view-model/quarteirao';
import { DistribuicaoTerritorialViewModel } from './view-model/distribuicao-territorial.vm';
import {
  FilterDistribuicaoTerritorialInput,
  filterDistribuicaoTerritorialSchema,
} from './dtos/filter-distribuicao-territorial.input';
import { ListarDistribuicaoTerritorial } from './use-cases/listar-distribuicao-territorial';
import { ListarTerritorioAgente } from './use-cases/listar-territorio-agente';
import { AtribuirQuadraTerritorial } from './use-cases/atribuir-quadra-territorial';
import { DesatribuirQuadraTerritorial } from './use-cases/desatribuir-quadra-territorial';
import { TerritorioAgenteViewModel } from './view-model/territorio-agente.vm';
import {
  AtribuirQuadraTerritorialBody,
  atribuirQuadraTerritorialSchema,
} from './dtos/atribuir-quadra-territorial.body';
import {
  BulkInsertQuarteiraoBody,
} from './dtos/bulk-insert-quarteiroes.body';
import { BulkInsertQuarteiroes } from './use-cases/bulk-insert-quarteiroes';
import {
  GerarLoteQuarteiraoBody,
  gerarLoteQuarteiraoSchema,
} from './dtos/gerar-lote-quarteiroes.body';
import { GerarLoteQuarteiroes } from './use-cases/gerar-lote-quarteiroes';
import {
  SaveQuarteiraoBody,
  saveQuarteiraoSchema,
} from './dtos/save-quarteirao.body';
import { SaveQuarteirao } from './use-cases/save-quarteirao';
import {
  DesenharQuarteiraoBody,
  desenharQuarteiraoSchema,
} from './dtos/desenhar-quarteirao.body';
import { DesenharQuarteirao } from './use-cases/desenhar-quarteirao';
import {
  GeometriaQuarteiraoBody,
  geometriaQuarteiraoSchema,
} from './dtos/geometria-quarteirao.body';
import {
  ImportarGeoJSONBody,
  importarGeoJSONSchema,
} from './dtos/importar-geojson-quarteiroes.body';
import { ImportarGeoJSONQuarteiroes } from './use-cases/importar-geojson-quarteiroes';
import {
  GerarQuadrasOSMBody,
  gerarQuadrasOSMSchema,
} from './dtos/gerar-quadras-osm.body';
import { GerarQuadrasOSM } from './use-cases/gerar-quadras-osm';
import { DeletarQuadrasBairro } from './use-cases/deletar-quadras-bairro';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Quarteirões')
@Controller('quarteiroes')
export class QuarteiraoController {
  constructor(
    private filterQuarteiroes: FilterQuarteiroes,
    private createQuarteirao: CreateQuarteirao,
    private deleteQuarteirao: DeleteQuarteirao,
    private filterDistribuicoes: FilterDistribuicoes,
    private createDistribuicao: CreateDistribuicao,
    private copiarDistribuicao: CopiarDistribuicao,
    private coberturaCiclo: CoberturaCiclo,
    private deleteDistribuicao: DeleteDistribuicao,
    private listByAgenteUc: ListDistribuicoesByAgente,
    private listarDistribuicaoTerritorialUc: ListarDistribuicaoTerritorial,
    private listarTerritorioAgenteUc: ListarTerritorioAgente,
    private atribuirQuadraTerritorialUc: AtribuirQuadraTerritorial,
    private desatribuirQuadraTerritorialUc: DesatribuirQuadraTerritorial,
    private upsertDistribuicoesUc: UpsertDistribuicoes,
    private deletarDistribuicoesUc: DeletarDistribuicoes,
    private bulkInsertQuarteiraoesUc: BulkInsertQuarteiroes,
    private gerarLoteQuarteiraoesUc: GerarLoteQuarteiroes,
    private saveQuarteiraoUc: SaveQuarteirao,
    private desenharQuarteiraoUc: DesenharQuarteirao,
    private importarGeoJSONUc: ImportarGeoJSONQuarteiroes,
    private gerarQuadrasOSMUc: GerarQuadrasOSM,
    private deletarQuadrasBairroUc: DeletarQuadrasBairro,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('distribuicoes/meu-territorio')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Território do agente autenticado — quadras fixas + imoveisCount + cicloAtivo, sem dependência de cópia de ciclo' })
  async getMeuTerritorio() {
    const result = await this.listarTerritorioAgenteUc.execute();
    return TerritorioAgenteViewModel.toHttp(result);
  }

  @Get('distribuicoes/territorial')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Distribuição territorial atual — registro mais recente por quadra, sem dependência de ciclo' })
  async listDistribuicaoTerritorial(
    @Query() query: FilterDistribuicaoTerritorialInput,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = filterDistribuicaoTerritorialSchema.parse(query);
    const items = await this.listarDistribuicaoTerritorialUc.execute(
      clienteId,
      parsed.agenteId,
      parsed.bairroId,
    );
    return items.map(DistribuicaoTerritorialViewModel.toHttp);
  }

  @Put('distribuicoes/territorial')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atribuir/transferir quadra a agente — distribuição territorial permanente (ciclo_id = NULL)' })
  async atribuirQuadraTerritorial(@Body() body: AtribuirQuadraTerritorialBody) {
    const parsed = atribuirQuadraTerritorialSchema.parse(body);
    const { distribuicao } = await this.atribuirQuadraTerritorialUc.execute(parsed);
    return DistribuicaoQuarteiraoViewModel.toHttp(distribuicao);
  }

  @Delete('distribuicoes/territorial/:quadraId')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover distribuição territorial permanente — não afeta histórico por ciclo' })
  async desatribuirQuadraTerritorial(@Param('quadraId') quadraId: string) {
    return this.desatribuirQuadraTerritorialUc.execute(quadraId);
  }

  @Get('distribuicoes/por-agente')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar códigos de quarteirões atribuídos a um agente no ciclo' })
  async listDistribuicoesByAgente(
    @Query('agenteId') agenteId: string,
    @Query('cicloId') cicloId: string,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.listByAgenteUc.execute(clienteId, agenteId, cicloId);
  }

  @Post('distribuicoes/upsert')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Batch upsert de distribuições de quarteirões (ON CONFLICT DO UPDATE)' })
  async upsertDistribuicoes(@Body() body: UpsertDistribuicoesBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = upsertDistribuicoesSchema.parse(body);
    await this.upsertDistribuicoesUc.execute(clienteId, parsed);
    return { ok: true };
  }

  @Post('distribuicoes/deletar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover distribuições por ciclo e lista de quarteirões' })
  async deletarDistribuicoes(@Body() body: DeletarDistribuicoesBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = deletarDistribuicoesSchema.parse(body);
    return this.deletarDistribuicoesUc.execute(clienteId, parsed);
  }

  @Get('cobertura')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary:
      'Cobertura de quarteirões no ciclo (com e sem agente atribuído)',
  })
  async cobertura(@Query() query: CoberturaCicloInput) {
    const parsed = coberturaCicloSchema.parse(query);
    return this.coberturaCiclo.execute(parsed);
  }

  @Get('distribuicoes')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar distribuições por ciclo' })
  async listDistribuicoes(@Query() query: FilterDistribuicaoInput) {
    const parsed = filterDistribuicaoSchema.parse(query);
    const { distribuicoes } = await this.filterDistribuicoes.execute(parsed);
    return distribuicoes.map(DistribuicaoQuarteiraoViewModel.toHttp);
  }

  @Post('distribuicoes/copiar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Copiar distribuições de um ciclo para outro' })
  async copiar(@Body() body: CopiarDistribuicaoBody) {
    const parsed = copiarDistribuicaoSchema.parse(body);
    return this.copiarDistribuicao.execute(parsed);
  }

  @Post('distribuicoes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar distribuição de quarteirão' })
  async createDistribuicaoHandler(@Body() body: CreateDistribuicaoBody) {
    const parsed = createDistribuicaoSchema.parse(body);
    const { distribuicao } = await this.createDistribuicao.execute(parsed);
    return DistribuicaoQuarteiraoViewModel.toHttp(distribuicao);
  }

  @Delete('distribuicoes/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover distribuição de quarteirão' })
  async deleteDistribuicaoHandler(@Param('id') id: string) {
    return this.deleteDistribuicao.execute(id);
  }

  @Post('bulk-insert')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Importar quarteirões em lote (upsert por código)' })
  async bulkInsert(@Body() body: BulkInsertQuarteiraoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.bulkInsertQuarteiraoesUc.execute(clienteId, body);
  }

  @Post('desenhar')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Criar quarteirão desenhando polígono no mapa — valida containment na região e sobreposições via PostGIS',
  })
  async desenhar(@Body() body: DesenharQuarteiraoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = desenharQuarteiraoSchema.parse(body);
    return this.desenharQuarteiraoUc.execute(clienteId, parsed);
  }

  @Put(':id/geometria')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Atualizar (ou remover) geometria de um quarteirão existente — null remove o polígono',
  })
  async updateGeometria(@Param('id') id: string, @Body() body: GeometriaQuarteiraoBody) {
    const parsed = geometriaQuarteiraoSchema.parse(body);
    const { quarteirao } = await this.saveQuarteiraoUc.execute(id, {
      geojson: parsed.geojson ?? undefined,
    });
    return QuarteiraoViewModel.toHttp(quarteirao);
  }

  @Post('importar-geojson')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Importar N quarteirões de um GeoJSON FeatureCollection — valida cada polígono via PostGIS (containment + sobreposição)',
  })
  async importarGeoJSON(@Body() body: ImportarGeoJSONBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = importarGeoJSONSchema.parse(body);
    return this.importarGeoJSONUc.execute(clienteId, parsed);
  }

  @Post('gerar-quadras-osm')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Gerar quadras candidatas a partir da malha viária do OpenStreetMap (buffer-and-subtract) — apenas preview, não persiste',
  })
  async gerarQuadrasOSM(@Body() body: GerarQuadrasOSMBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = gerarQuadrasOSMSchema.parse(body);
    return this.gerarQuadrasOSMUc.execute(clienteId, parsed);
  }

  @Post('gerar-lote')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Gerar quarteirões em lote por prefixo e intervalo numérico' })
  async gerarLote(@Body() body: GerarLoteQuarteiraoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const parsed = gerarLoteQuarteiraoSchema.parse(body);
    return this.gerarLoteQuarteiraoesUc.execute(clienteId, parsed);
  }

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar quarteirões' })
  async filter(@Query() filters: FilterQuarteiraoInput) {
    const parsed = filterQuarteiraoSchema.parse(filters);
    const { quarteiroes } = await this.filterQuarteiroes.execute(parsed);
    return quarteiroes.map(QuarteiraoViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar quarteirão' })
  async create(@Body() body: CreateQuarteiraoBody) {
    const parsed = createQuarteiraoSchema.parse(body);
    const { quarteirao } = await this.createQuarteirao.execute(parsed);
    return QuarteiraoViewModel.toHttp(quarteirao);
  }

  @Patch(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar quarteirão (patch parcial — geojson gera centroide automaticamente)' })
  async save(@Param('id') id: string, @Body() body: SaveQuarteiraoBody) {
    const parsed = saveQuarteiraoSchema.parse(body);
    const { quarteirao } = await this.saveQuarteiraoUc.execute(id, parsed);
    return QuarteiraoViewModel.toHttp(quarteirao);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Excluir quarteirão (soft delete)' })
  async delete(@Param('id') id: string) {
    return this.deleteQuarteirao.execute(id);
  }
}
