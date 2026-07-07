import { NestFactory } from '@nestjs/core';
import express from 'express';
import { createNestApp } from './bootstrap';

async function bootstrap() {
  const expressApp = express();
  const app = await createNestApp(expressApp);
  await app.init();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
