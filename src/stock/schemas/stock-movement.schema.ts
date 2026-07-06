import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true })
  product: Types.ObjectId;

  @Prop({ required: true, enum: MovementType })
  type: MovementType;

  @Prop({ required: true })
  quantity: number;

  @Prop({ trim: true })
  reason?: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
