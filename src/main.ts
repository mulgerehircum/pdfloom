import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// Templates can embed a base64 image (up to ~2MB raw, ~2.7MB as base64) directly in the
// JSON body — Express's default body-parser limit (100kb) rejects that with a 413, so
// bodyParser is disabled here and reconfigured with a higher limit below.
const BODY_SIZE_LIMIT = '10mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
