import { Controller, Get, Header } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Controller('landing')
export class LandingController {
  @Get()
  @Header('Content-Type', 'text/html')
  async getLandingPage(): Promise<string> {
    return readFile(join(__dirname, 'landing.html'), 'utf-8');
  }
}
