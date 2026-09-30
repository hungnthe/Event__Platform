import { INestApplication } from '@nestjs/common'; import { Test } from '@nestjs/testing'; import request from 'supertest'; import { AppModule } from '../src/app.module';
describe('Health endpoints', () => {
  let app: INestApplication;
  beforeAll(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); await app.init(); });
  afterAll(async () => { await app.close(); });
  it('/api/v1/health/live returns without external services', async () => { await request(app.getHttpServer()).get('/api/v1/health/live').expect(200).expect(({ body }: { body: { status: string } }) => expect(body.status).toBe('ok')); });
  it('/api/v1/health/ready reports all test dependencies', async () => { await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200).expect(({ body }: { body: { dependencies: { postgres: string; redis: string; objectStorage: string } } }) => expect(body.dependencies).toEqual({ postgres: 'up', redis: 'up', objectStorage: 'up' })); });
});
