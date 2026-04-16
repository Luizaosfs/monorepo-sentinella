import { DynamicModule, Logger, Module } from '@nestjs/common';

import { PrismaContext } from './prisma/prisma.context';
import { PrismaService } from './prisma/prisma.service';
import { RepositoryScannerService } from './repository-scanner.service';

@Module({})
export class RepositoryModule {
  private static readonly logger = new Logger(RepositoryModule.name);

  static async forRoot(): Promise<DynamicModule> {
    RepositoryModule.logger.log('🚀 Inicializando RepositoryModule...');

    const scanner = new RepositoryScannerService();
    const repositoryProviders = await scanner.scanRepositories();

    RepositoryModule.logger.log(
      `📊 Total de repositórios registrados: ${repositoryProviders.length}`,
    );

    return {
      module: RepositoryModule,
      providers: [
        ...repositoryProviders,
        RepositoryScannerService,
        PrismaService,
        PrismaContext,
      ],
      imports: [],
      exports: [...repositoryProviders.map((provider) => provider.provide)],
    };
  }
}
