import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProductsModule } from '../products/products.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [ProductsModule, TemplatesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
