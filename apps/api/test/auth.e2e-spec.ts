import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication CSRF endpoint', () => {
  let app: INestApplication;
  beforeAll(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); await app.init(); });
  afterAll(async () => { await app.close(); });
  it('issues a CSRF token and rejects a login without it', async () => {
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);
    expect(csrf.body.token).toEqual(expect.any(String));
    expect(csrf.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('eventflow_csrf=')]));
    await request(app.getHttpServer()).post('/api/v1/auth/login').set('origin', 'http://localhost:3000').send({ email: 'admin@example.com', password: 'not-a-password', rememberMe: false }).expect(403);
  });
});
