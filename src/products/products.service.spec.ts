import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './schemas/product.schema';

describe('ProductsService', () => {
  let service: ProductsService;

  const baseProduct = {
    _id: 'p1',
    sku: 'ABC-1',
    quantity: 10,
    unitPrice: 5,
    lowStockThreshold: 2,
  };

  const productModelMock = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: getModelToken(Product.name), useValue: productModelMock }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('adjustQuantity', () => {
    it('increases quantity for a positive delta', async () => {
      productModelMock.findById.mockReturnValue({ exec: () => Promise.resolve({ ...baseProduct }) });
      productModelMock.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ ...baseProduct, quantity: 15 }),
      });

      const result = await service.adjustQuantity('p1', 5);

      expect(result.quantity).toBe(15);
      expect(productModelMock.findByIdAndUpdate).toHaveBeenCalledWith('p1', { quantity: 15 }, { new: true });
    });

    it('throws ConflictException when the delta would drive quantity below zero', async () => {
      productModelMock.findById.mockReturnValue({ exec: () => Promise.resolve({ ...baseProduct, quantity: 3 }) });

      await expect(service.adjustQuantity('p1', -5)).rejects.toBeInstanceOf(ConflictException);
      expect(productModelMock.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows a delta that brings quantity exactly to zero', async () => {
      productModelMock.findById.mockReturnValue({ exec: () => Promise.resolve({ ...baseProduct, quantity: 5 }) });
      productModelMock.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ ...baseProduct, quantity: 0 }),
      });

      const result = await service.adjustQuantity('p1', -5);

      expect(result.quantity).toBe(0);
    });
  });
});
