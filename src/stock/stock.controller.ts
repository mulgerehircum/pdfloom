import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('movements')
  recordMovement(@Body() dto: CreateMovementDto) {
    return this.stockService.recordMovement(dto);
  }

  @Get('movements/:productId')
  findForProduct(@Param('productId') productId: string) {
    return this.stockService.findForProduct(productId);
  }
}
