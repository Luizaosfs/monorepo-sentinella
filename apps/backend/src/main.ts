import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { patchNestJsSwagger } from 'nestjs-zod';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : '*'),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Sentinella Web API')
    .setDescription('API do Sentinella Web — Vigilância Entomológica Municipal')
    .setVersion('1.0')
    .addTag('Sentinella')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'token',
    )
    .addSecurityRequirements('token')
    .build();

  patchNestJsSwagger();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.use('/reference', apiReference({ spec: { content: document } }));

  await app.listen(process.env.PORT ?? 3333);
  const logger = new Logger('Bootstrap');
  logger.log(`Sentinella API rodando na porta ${process.env.PORT ?? 3333}`);
  Logger.verbose(
    `\x1b[33m💰💵 API running on port ${process.env.PORT ?? 3333} 💵💰`,
  );
  Logger.verbose(
    `\x1b[36mAccess at http://127.0.0.1:${process.env.PORT ?? 3333}/reference ...\n`,
  );
}
bootstrap();
