import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { logger } from './utils/logger';

async function bootstrap() {
  dotenv.config();
  // const app = await NestFactory.create(AppModule);
  const app = await NestFactory.create(AppModule, {
    logger,
  });
  const configService = app.get(ConfigService);

  // Dynamic origin OR allow all
  // const corsOrigin = configService.get<string>('CORS_ORIGIN') || '*';

  // app.enableCors({
  //   origin: corsOrigin,
  //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: '*', 
  //   credentials: true,
  //   preflightContinue: false,
  //   optionsSuccessStatus: 200,
  // });

  const corsEnv = configService.get<string>('CORS_ORIGIN');

  const corsOrigin =
    corsEnv && corsEnv !== '*'
      ? corsEnv.split(',').map(origin => origin.trim())
      : '*';

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();