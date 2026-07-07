import express from 'express';
import { createNestApp } from './bootstrap';

let expressApp: express.Express | null = null;

export default async function handler(req: express.Request, res: express.Response) {
  if (!expressApp) {
    const app = express();
    const nestApp = await createNestApp(app);
    await nestApp.init();
    expressApp = app;
  }
  return expressApp(req, res);
}
