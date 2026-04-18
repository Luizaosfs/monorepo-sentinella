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
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { PluvioSchedulerService } from '@modules/pluvio/pluvio-scheduler.service';

import { CreateJobBody, createJobSchema } from './dtos/create-job.body';
import { CreateJob } from './use-cases/create-job';
import { FilterJob } from './use-cases/filter-job';
import { GetJob } from './use-cases/get-job';
import { JobViewModel } from './view-model/job';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Jobs')
@Controller('jobs')
export class JobController {
  constructor(
    private jobFilter: FilterJob,
    private jobGet: GetJob,
    private jobCreate: CreateJob,
    private pluvioScheduler: PluvioSchedulerService,
  ) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar jobs' })
  async listJobs(@Query('status') status?: string) {
    const { items } = await this.jobFilter.execute(status);
    return items.map(JobViewModel.toHttp);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Detalhar job' })
  async getJob(@Param('id') id: string) {
    const { job } = await this.jobGet.execute(id);
    return job ? JobViewModel.toHttp(job) : null;
  }

  @Post('pluvio-risco-daily')
  @Roles('admin')
  @ApiOperation({ summary: 'Executar job pluvio-risco-daily manualmente' })
  async pluvioRiscoDaily() {
    return this.pluvioScheduler.riscoDaily();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Enfileirar job manualmente' })
  async createJob(@Body() body: CreateJobBody) {
    const parsed = createJobSchema.parse(body);
    const { job } = await this.jobCreate.execute(parsed);
    return JobViewModel.toHttp(job);
  }
}
