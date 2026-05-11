import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '@shared/modules/database/database.module';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { QuarteiraoController } from './quarteirao.controller';
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
import { BulkInsertQuarteiroes } from './use-cases/bulk-insert-quarteiroes';
import { GerarLoteQuarteiroes } from './use-cases/gerar-lote-quarteiroes';
import { SaveQuarteirao } from './use-cases/save-quarteirao';
import { DesenharQuarteirao } from './use-cases/desenhar-quarteirao';
import { ImportarGeoJSONQuarteiroes } from './use-cases/importar-geojson-quarteiroes';
import { GerarQuadrasOSM } from './use-cases/gerar-quadras-osm';
import { EnsureCicloEditavel } from './use-cases/ensure-ciclo-editavel';
import { ListarDistribuicaoTerritorial } from './use-cases/listar-distribuicao-territorial';
import { ListarTerritorioAgente } from './use-cases/listar-territorio-agente';
import { AtribuirQuadraTerritorial } from './use-cases/atribuir-quadra-territorial';
import { DesatribuirQuadraTerritorial } from './use-cases/desatribuir-quadra-territorial';
import { DeletarQuadrasBairro } from './use-cases/deletar-quadras-bairro';

@Module({
  providers: [
    FilterQuarteiroes,
    CreateQuarteirao,
    DeleteQuarteirao,
    FilterDistribuicoes,
    CreateDistribuicao,
    CopiarDistribuicao,
    CoberturaCiclo,
    DeleteDistribuicao,
    ListDistribuicoesByAgente,
    UpsertDistribuicoes,
    DeletarDistribuicoes,
    BulkInsertQuarteiroes,
    GerarLoteQuarteiroes,
    SaveQuarteirao,
    DesenharQuarteirao,
    ImportarGeoJSONQuarteiroes,
    GerarQuadrasOSM,
    EnsureCicloEditavel,
    ListarDistribuicaoTerritorial,
    ListarTerritorioAgente,
    AtribuirQuadraTerritorial,
    DesatribuirQuadraTerritorial,
    DeletarQuadrasBairro,
    JwtService,
    PrismaService,
  ],
  controllers: [QuarteiraoController],
  imports: [DatabaseModule],
})
export class QuarteiraoModule {}
