import { join } from 'path';
import { cwd } from 'process';

import { Injectable, Logger } from '@nestjs/common';
import { glob } from 'glob';
import { PRISMA_REPOSITORY_METADATA } from 'src/decorators/prisma-repository.decorator';

@Injectable()
export class RepositoryScannerService {
  private readonly logger = new Logger(RepositoryScannerService.name);

  async scanRepositories(): Promise<any[]> {
    this.logger.debug('🕵️  Iniciando scan de repositórios...');

    const providers: any[] = [];
    const repositories = await this.autoScanFiles();

    if (repositories.length === 0) {
      this.logger.warn('⚠️  Scan automático retornou vazio');
      return [];
    }

    this.logger.debug(
      `📁 Encontradas ${repositories.length} classes para análise`,
    );

    for (const RepositoryClass of repositories) {
      try {
        const metadata = Reflect.getMetadata(
          PRISMA_REPOSITORY_METADATA,
          RepositoryClass,
        );
        if (metadata) {
          providers.push(metadata);
        }
      } catch (error) {
        this.logger.error(
          `💥 Erro ao analisar ${RepositoryClass.name}:`,
          error.message,
        );
      }
    }

    this.logger.debug(`🎯 Total de providers registrados: ${providers.length}`);
    return providers;
  }

  private async autoScanFiles(): Promise<Function[]> {
    // Em build compilado (`nest build` → dist/*.js) varremos `.js`.
    // Em jest (ts-jest in-memory) varremos `.ts` no src/, evitando o G15:
    // sem dist/ os repositórios nunca eram registrados e o boot do AppModule
    // falhava em DI silenciosamente dentro de `beforeAll`.
    const isCompiled = __filename.endsWith('.js');
    const ext = isCompiled ? 'js' : 'ts';
    const patterns = [`**/prisma*.repository.${ext}`];
    const repositories: Function[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/*.d.ts',
            '**/*.spec.ts',
          ],
        });
        for (const file of files) {
          await this.loadRepositoryFromFile(file, repositories);
        }
      } catch (error) {
        this.logger.error(`❌ Erro no pattern ${pattern}:`, error.message);
      }
    }

    return repositories;
  }

  private async loadRepositoryFromFile(
    filePath: string,
    repositories: Function[],
  ): Promise<void> {
    try {
      const absolutePath = join(cwd(), filePath);
      const module = await import(absolutePath);

      for (const [_key, value] of Object.entries(module)) {
        if (this.isValidRepositoryClass(value)) {
          repositories.push(value as any);
        }
      }
    } catch (error) {
      this.logger.error(`💥 Erro ao carregar ${filePath}:`, error.message);
    }
  }

  private isValidRepositoryClass(cls: any): boolean {
    if (typeof cls !== 'function') return false;
    try {
      const isClass = /^class\s/.test(Function.prototype.toString.call(cls));
      const hasMetadata = Reflect.getMetadata(PRISMA_REPOSITORY_METADATA, cls);
      return isClass && hasMetadata;
    } catch {
      return false;
    }
  }
}
