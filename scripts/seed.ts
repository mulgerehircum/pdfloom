// Populates the database with realistic sample data for demos/screenshots.
// Run with: npm run seed  (wipes existing products/movements/templates first — leaves users alone)
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Product, ProductSchema } from '../src/products/schemas/product.schema';
import { StockMovement, StockMovementSchema, MovementType } from '../src/stock/schemas/stock-movement.schema';
import { Template, TemplateSchema } from '../src/templates/schemas/template.schema';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import { compileTemplateToHtml } from '../src/templates/template-compiler';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pdffloom';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const PRODUCTS = [
  { name: 'Wireless Mouse', sku: 'ELEC-001', category: 'Electronics', quantity: 42, unitPrice: 19.99, lowStockThreshold: 10 },
  { name: 'Mechanical Keyboard', sku: 'ELEC-002', category: 'Electronics', quantity: 8, unitPrice: 74.5, lowStockThreshold: 10 },
  { name: '27" Monitor', sku: 'ELEC-003', category: 'Electronics', quantity: 15, unitPrice: 249.0, lowStockThreshold: 5 },
  { name: 'USB-C Hub', sku: 'ELEC-004', category: 'Electronics', quantity: 3, unitPrice: 32.75, lowStockThreshold: 15 },
  { name: 'Webcam 1080p', sku: 'ELEC-005', category: 'Electronics', quantity: 27, unitPrice: 45.0, lowStockThreshold: 8 },
  { name: 'A4 Copy Paper (Ream)', sku: 'OFF-001', category: 'Office Supplies', quantity: 120, unitPrice: 4.99, lowStockThreshold: 30 },
  { name: 'Ballpoint Pens (Box of 12)', sku: 'OFF-002', category: 'Office Supplies', quantity: 60, unitPrice: 3.25, lowStockThreshold: 20 },
  { name: 'Sticky Notes Pack', sku: 'OFF-003', category: 'Office Supplies', quantity: 5, unitPrice: 6.4, lowStockThreshold: 10 },
  { name: 'Stapler', sku: 'OFF-004', category: 'Office Supplies', quantity: 18, unitPrice: 8.99, lowStockThreshold: 5 },
  { name: 'Whiteboard Markers (Set of 4)', sku: 'OFF-005', category: 'Office Supplies', quantity: 2, unitPrice: 9.5, lowStockThreshold: 6 },
  { name: 'Office Chair', sku: 'FURN-001', category: 'Furniture', quantity: 6, unitPrice: 189.99, lowStockThreshold: 3 },
  { name: 'Standing Desk', sku: 'FURN-002', category: 'Furniture', quantity: 4, unitPrice: 429.0, lowStockThreshold: 2 },
  { name: 'Filing Cabinet', sku: 'FURN-003', category: 'Furniture', quantity: 1, unitPrice: 145.0, lowStockThreshold: 3 },
  { name: 'Bookshelf', sku: 'FURN-004', category: 'Furniture', quantity: 9, unitPrice: 98.5, lowStockThreshold: 3 },
  { name: 'Packing Boxes (Bundle of 10)', sku: 'WARE-001', category: 'Warehouse', quantity: 200, unitPrice: 12.0, lowStockThreshold: 50 },
  { name: 'Pallet Wrap Roll', sku: 'WARE-002', category: 'Warehouse', quantity: 14, unitPrice: 22.3, lowStockThreshold: 10 },
  { name: 'Hand Truck Dolly', sku: 'WARE-003', category: 'Warehouse', quantity: 2, unitPrice: 65.0, lowStockThreshold: 2 },
];

// Movement history per SKU: [type, quantity, reason, daysAgoOfMovement]
const MOVEMENTS: Array<{ sku: string; type: MovementType; quantity: number; reason: string; days: number }> = [
  { sku: 'ELEC-001', type: MovementType.IN, quantity: 50, reason: 'Initial stock intake', days: 30 },
  { sku: 'ELEC-001', type: MovementType.OUT, quantity: 8, reason: 'Sales order #1042', days: 12 },
  { sku: 'ELEC-002', type: MovementType.IN, quantity: 20, reason: 'Initial stock intake', days: 30 },
  { sku: 'ELEC-002', type: MovementType.OUT, quantity: 12, reason: 'Sales order #1050', days: 5 },
  { sku: 'ELEC-003', type: MovementType.IN, quantity: 20, reason: 'Initial stock intake', days: 25 },
  { sku: 'ELEC-003', type: MovementType.OUT, quantity: 5, reason: 'Sales order #1061', days: 3 },
  { sku: 'ELEC-004', type: MovementType.IN, quantity: 15, reason: 'Initial stock intake', days: 25 },
  { sku: 'ELEC-004', type: MovementType.OUT, quantity: 12, reason: 'Sales order #1070', days: 2 },
  { sku: 'OFF-003', type: MovementType.IN, quantity: 15, reason: 'Initial stock intake', days: 20 },
  { sku: 'OFF-003', type: MovementType.OUT, quantity: 10, reason: 'Internal supply restock', days: 4 },
  { sku: 'OFF-005', type: MovementType.IN, quantity: 10, reason: 'Initial stock intake', days: 18 },
  { sku: 'OFF-005', type: MovementType.OUT, quantity: 8, reason: 'Internal supply restock', days: 1 },
  { sku: 'FURN-003', type: MovementType.IN, quantity: 4, reason: 'Initial stock intake', days: 40 },
  { sku: 'FURN-003', type: MovementType.OUT, quantity: 3, reason: 'Office fit-out delivery', days: 6 },
  { sku: 'WARE-003', type: MovementType.IN, quantity: 5, reason: 'Initial stock intake', days: 15 },
  { sku: 'WARE-003', type: MovementType.ADJUSTMENT, quantity: -3, reason: 'Damaged in transit — write-off', days: 2 },
];

const DEMO_TEMPLATE_ELEMENTS = [
  { id: 'title', type: 'text' as const, x: 40, y: 30, width: 400, height: 40, page: 0, fontSize: 22, content: 'Stock Report' },
  { id: 'generatedAt', type: 'field' as const, x: 40, y: 75, width: 300, height: 20, page: 0, fontSize: 11, fieldPath: 'generatedAt' },
  {
    id: 'table',
    type: 'table' as const,
    x: 40,
    y: 110,
    width: 714,
    height: 500,
    page: 0,
    fontSize: 11,
    itemsPath: 'products',
    columns: [
      { label: 'SKU', fieldPath: 'sku' },
      { label: 'Name', fieldPath: 'name' },
      { label: 'Category', fieldPath: 'category' },
      { label: 'Qty', fieldPath: 'quantity' },
      { label: 'Unit Price', fieldPath: 'unitPrice' },
      { label: 'Value', fieldPath: 'value' },
    ],
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  const ProductModel = mongoose.model(Product.name, ProductSchema);
  const MovementModel = mongoose.model(StockMovement.name, StockMovementSchema);
  const TemplateModel = mongoose.model(Template.name, TemplateSchema);
  const UserModel = mongoose.model(User.name, UserSchema);

  await Promise.all([ProductModel.deleteMany({}), MovementModel.deleteMany({}), TemplateModel.deleteMany({})]);
  console.log('Cleared existing products, stock movements, and templates.');

  let demoUser = await UserModel.findOne({ username: 'demo' });
  if (!demoUser) {
    demoUser = await UserModel.create({ username: 'demo', passwordHash: await bcrypt.hash('demo1234', 10) });
    console.log('Created demo user "demo" / "demo1234".');
  }

  const createdProducts = await ProductModel.insertMany(PRODUCTS);
  const productBySku = new Map(createdProducts.map((p) => [p.sku, p]));
  console.log(`Inserted ${createdProducts.length} products.`);

  const movementDocs = MOVEMENTS.map((m) => {
    const product = productBySku.get(m.sku);
    if (!product) throw new Error(`Seed data error: no product for SKU ${m.sku}`);
    return {
      product: product._id,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      createdAt: daysAgo(m.days),
    };
  });
  await MovementModel.insertMany(movementDocs);
  console.log(`Inserted ${movementDocs.length} stock movements.`);

  const compiledTemplate = compileTemplateToHtml({
    pageWidth: 794,
    pageHeight: 1123,
    pageCount: 1,
    elements: DEMO_TEMPLATE_ELEMENTS as any,
  });
  await TemplateModel.create({
    name: 'Demo Stock Report',
    pageWidth: 794,
    pageHeight: 1123,
    pageCount: 1,
    elements: DEMO_TEMPLATE_ELEMENTS,
    compiledTemplate,
    createdBy: demoUser._id,
  });
  console.log('Inserted 1 demo template.');

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
