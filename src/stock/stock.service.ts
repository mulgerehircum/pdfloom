import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockMovement, StockMovementDocument, MovementType } from './schemas/stock-movement.schema';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    private readonly productsService: ProductsService
  ) {}

  async recordMovement(dto: CreateMovementDto): Promise<StockMovement> {
    const delta = this.toQuantityDelta(dto.type, dto.quantity);

    // Adjust the product first so an insufficient-stock error blocks the movement from being logged.
    await this.productsService.adjustQuantity(dto.product, delta);

    return this.movementModel.create(dto);
  }

  findForProduct(productId: string): Promise<StockMovement[]> {
    return this.movementModel.find({ product: productId }).sort({ createdAt: -1 }).exec();
  }

  private toQuantityDelta(type: MovementType, quantity: number): number {
    switch (type) {
      case MovementType.IN:
        return quantity;
      case MovementType.OUT:
        return -quantity;
      case MovementType.ADJUSTMENT:
        return quantity;
      default:
        throw new BadRequestException(`Unknown movement type: ${type}`);
    }
  }
}
