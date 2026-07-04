import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StockService } from './stock.service';
import { StockMovement, MovementType } from './schemas/stock-movement.schema';
import { ProductsService } from '../products/products.service';

describe('StockService', () => {
  let service: StockService;

  const movementModelMock = {
    create: jest.fn(),
  };

  const productsServiceMock = {
    adjustQuantity: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: getModelToken(StockMovement.name), useValue: movementModelMock },
        { provide: ProductsService, useValue: productsServiceMock },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  it('applies a positive delta for an IN movement', async () => {
    productsServiceMock.adjustQuantity.mockResolvedValue({ quantity: 15 });
    movementModelMock.create.mockResolvedValue({ product: 'p1', type: MovementType.IN, quantity: 5 });

    await service.recordMovement({ product: 'p1', type: MovementType.IN, quantity: 5 });

    expect(productsServiceMock.adjustQuantity).toHaveBeenCalledWith('p1', 5);
  });

  it('applies a negative delta for an OUT movement', async () => {
    productsServiceMock.adjustQuantity.mockResolvedValue({ quantity: 5 });
    movementModelMock.create.mockResolvedValue({ product: 'p1', type: MovementType.OUT, quantity: 5 });

    await service.recordMovement({ product: 'p1', type: MovementType.OUT, quantity: 5 });

    expect(productsServiceMock.adjustQuantity).toHaveBeenCalledWith('p1', -5);
  });

  it('does not persist a movement when the underlying quantity adjustment fails', async () => {
    productsServiceMock.adjustQuantity.mockRejectedValue(new Error('insufficient stock'));

    await expect(service.recordMovement({ product: 'p1', type: MovementType.OUT, quantity: 999 })).rejects.toThrow();

    expect(movementModelMock.create).not.toHaveBeenCalled();
  });
});
