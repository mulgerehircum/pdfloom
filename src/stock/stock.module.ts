import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockMovement, StockMovementSchema } from './schemas/stock-movement.schema';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: StockMovement.name, schema: StockMovementSchema }]), ProductsModule],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
