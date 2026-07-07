import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded, type Express } from 'express';
import { AppModule } from './app.module';

const BODY_SIZE_LIMIT = '10mb';

export async function createNestApp(expressApp: Express): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });
  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}
