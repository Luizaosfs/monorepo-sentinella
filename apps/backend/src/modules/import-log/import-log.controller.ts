import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateImportLogBody,
  createImportLogSchema,
} from './dtos/create-import-log.body';
import {
  FilterImportLogInput,
  filterImportLogSchema,
} from './dtos/filter-import-log.input';
import { CreateImport } from './use-cases/create-import';
import { FilterImports } from './use-cases/filter-imports';
import { GetImport } from './use-cases/get-import';
import { ImportLogViewModel } from './view-model/import-log';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Importação (logs)')
@Controller('import-log')
export class ImportLogController {
  constructor(
    private filterImports: FilterImports,
    private createImport: CreateImport,
    private getImport: GetImport,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar logs de importação em lote de imóveis' })
  async filter(@Query() filters: FilterImportLogInput) {
    const parsed = filterImportLogSchema.parse(filters);
    const { items } = await this.filterImports.execute(parsed);
    return items.map(ImportLogViewModel.toHttp);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar log de importação por ID' })
  async findById(@Param('id') id: string) {
    const { importLog } = await this.getImport.execute(id);
    return ImportLogViewModel.toHttp(importLog);
  }

  @Post()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Registrar log de importação (somente criação; log imutável)',
  })
  async create(@Body() body: CreateImportLogBody) {
    const parsed = createImportLogSchema.parse(body);
    const { importLog } = await this.createImport.execute(parsed);
    return ImportLogViewModel.toHttp(importLog);
  }
}
