import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productModel.findOne({ sku: dto.sku.toUpperCase() });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    return this.productModel.create(dto);
  }

  findAll(): Promise<Product[]> {
    return this.productModel.find().sort({ name: 1 }).exec();
  }

  findLowStock(): Promise<Product[]> {
    return this.productModel
      .find({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] } })
      .sort({ quantity: 1 })
      .exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  async adjustQuantity(id: string, delta: number): Promise<Product> {
    const product = await this.findOne(id);
    const newQuantity = product.quantity + delta;
    if (newQuantity < 0) {
      throw new ConflictException(`Insufficient stock for product ${id}: has ${product.quantity}, requested change ${delta}`);
    }
    return this.update(id, { quantity: newQuantity });
  }
}
