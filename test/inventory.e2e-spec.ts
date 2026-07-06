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
  let otherAuthHeader: string;

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

    // A second account, used to prove templates are private to their owner.
    const otherRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'e2e-tester-2', password: 'password123' })
      .expect(201);
    otherAuthHeader = `Bearer ${otherRegisterRes.body.accessToken}`;
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

  it('scopes templates to their creator: private to manage, but publicly renderable', async () => {
    const templatePayload = {
      name: 'Owned template',
      elements: [{ id: 'el1', type: 'text', x: 40, y: 40, width: 160, height: 24, fontSize: 12, content: 'Hi' }],
    };

    // Listing and saving both require a token.
    await request(app.getHttpServer()).get('/templates').expect(401);
    await request(app.getHttpServer()).post('/templates').send(templatePayload).expect(401);

    const createRes = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', authHeader)
      .send(templatePayload)
      .expect(201);
    const templateId = createRes.body._id;

    // The owner sees it in their list and can fetch/update/delete it.
    const listRes = await request(app.getHttpServer()).get('/templates').set('Authorization', authHeader).expect(200);
    expect(listRes.body.some((t: { _id: string }) => t._id === templateId)).toBe(true);
    await request(app.getHttpServer()).get(`/templates/${templateId}`).set('Authorization', authHeader).expect(200);
    await request(app.getHttpServer())
      .patch(`/templates/${templateId}`)
      .set('Authorization', authHeader)
      .send({ name: 'Renamed by owner' })
      .expect(200);

    // A different logged-in user can't see, fetch, update, or delete someone else's template.
    const otherListRes = await request(app.getHttpServer())
      .get('/templates')
      .set('Authorization', otherAuthHeader)
      .expect(200);
    expect(otherListRes.body.some((t: { _id: string }) => t._id === templateId)).toBe(false);
    await request(app.getHttpServer()).get(`/templates/${templateId}`).set('Authorization', otherAuthHeader).expect(403);
    await request(app.getHttpServer())
      .patch(`/templates/${templateId}`)
      .set('Authorization', otherAuthHeader)
      .send({ name: 'Hijacked' })
      .expect(403);
    await request(app.getHttpServer()).delete(`/templates/${templateId}`).set('Authorization', otherAuthHeader).expect(403);

    // Rendering the template's output is still public regardless of ownership — that's a
    // separate concern (sharing a report link) from managing the template itself.
    await request(app.getHttpServer()).get(`/reports/custom/${templateId}/pdf`).expect(200);

    // The owner can delete it.
    await request(app.getHttpServer()).delete(`/templates/${templateId}`).set('Authorization', authHeader).expect(200);
    await request(app.getHttpServer()).get(`/templates/${templateId}`).set('Authorization', authHeader).expect(404);
  }, 30000);
});
