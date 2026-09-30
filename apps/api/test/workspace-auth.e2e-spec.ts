import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Event workspace authentication boundary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it.each([
    '/api/v1/me/events',
    '/api/v1/me/tasks',
    '/api/v1/events/00000000-0000-4000-8000-000000000001',
    '/api/v1/events/00000000-0000-4000-8000-000000000001/progress',
    '/api/v1/events/00000000-0000-4000-8000-000000000001/workflow',
    '/api/v1/events/00000000-0000-4000-8000-000000000001/workflow/stages/00000000-0000-4000-8000-000000000004/tasks',
    '/api/v1/tasks/00000000-0000-4000-8000-000000000002',
    '/api/v1/notifications',
    '/api/v1/notifications/unread-count',
    '/api/v1/notifications/preferences',
    '/api/v1/calendar/items?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z',
    '/api/v1/calendar/items/EVENT/00000000-0000-4000-8000-000000000003',
  ])('rejects unauthenticated access to %s before querying workspace data', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .expect(401)
      .expect(({ body }: { body: { error?: { code?: string } } }) => {
        expect(body.error?.code).toBe('AUTH_SESSION_REQUIRED');
      });
  });
});
