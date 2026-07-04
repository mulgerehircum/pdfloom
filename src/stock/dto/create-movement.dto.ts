import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MovementType } from '../schemas/stock-movement.schema';

export class CreateMovementDto {
  @IsMongoId()
  product: string;

  @IsEnum(MovementType)
  type: MovementType;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
