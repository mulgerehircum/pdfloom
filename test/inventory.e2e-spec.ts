import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Inventory flow (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;
  let authHeader: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'e2e-tester', password: 'password123' })
      .expect(201);
    authHeader = `Bearer ${registerRes.body.accessToken}`;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates a product, records stock in/out, and reflects the final quantity (no auth needed)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Widget', sku: 'wid-1', unitPrice: 9.99, quantity: 0, lowStockThreshold: 5 })
      .expect(201);

    const productId = createRes.body._id;
    expect(productId).toBeDefined();

    await request(app.getHttpServer())
      .post('/stock/movements')
      .send({ product: productId, type: 'IN', quantity: 20, reason: 'initial stock' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/stock/movements')
      .send({ product: productId, type: 'OUT', quantity: 8, reason: 'sale' })
      .expect(201);

    const productRes = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);
    expect(productRes.body.quantity).toBe(12);

    const movementsRes = await request(app.getHttpServer()).get(`/stock/movements/${productId}`).expect(200);
    expect(movementsRes.body).toHaveLength(2);
  });

  it('rejects a stock-out movement that would drive quantity negative', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Gadget', sku: 'gad-1', unitPrice: 4.5, quantity: 2, lowStockThreshold: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/stock/movements')
      .send({ product: createRes.body._id, type: 'OUT', quantity: 5 })
      .expect(409);
  });

  it('flags low-stock products and generates a stock report PDF (both public)', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Low Stock Item', sku: 'low-1', unitPrice: 1, quantity: 1, lowStockThreshold: 5 })
      .expect(201);

    const lowStockRes = await request(app.getHttpServer()).get('/products/low-stock').expect(200);
    expect(lowStockRes.body.some((p: { sku: string }) => p.sku === 'LOW-1')).toBe(true);

    const pdfRes = await request(app.getHttpServer()).get('/reports/stock-pdf').expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(pdfRes.body) ? pdfRes.body.length : pdfRes.text.length).toBeGreaterThan(0);
  }, 30000);

  it('lets anyone browse templates, but only a logged-in user can save one', async () => {
    const templatePayload = {
      name: 'Anon test template',
      elements: [{ id: 'el1', type: 'text', x: 40, y: 40, width: 160, height: 24, fontSize: 12, content: 'Hi' }],
    };

    // Anyone can list templates without a token.
    await request(app.getHttpServer()).get('/templates').expect(200);

    // Saving (creating) one without a token is rejected.
    await request(app.getHttpServer()).post('/templates').send(templatePayload).expect(401);

    // With a token, it succeeds — and the saved template is still publicly readable/renderable.
    const createRes = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', authHeader)
      .send(templatePayload)
      .expect(201);

    await request(app.getHttpServer()).get(`/templates/${createRes.body._id}`).expect(200);
    await request(app.getHttpServer()).get(`/reports/custom/${createRes.body._id}/pdf`).expect(200);

    // Updating (also "saving") without a token is rejected too.
    await request(app.getHttpServer())
      .patch(`/templates/${createRes.body._id}`)
      .send({ name: 'Renamed without auth' })
      .expect(401);
  }, 30000);
});
