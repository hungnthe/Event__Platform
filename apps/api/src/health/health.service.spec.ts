import { ServiceUnavailableException } from '@nestjs/common'; import type { ObjectStorageService } from '../infrastructure/object-storage.service'; import type { RedisService } from '../infrastructure/redis.service'; import type { PrismaService } from '../prisma/prisma.service'; import { HealthService } from './health.service';
describe('HealthService', () => {
  const healthy = { isHealthy: jest.fn<Promise<boolean>, []>().mockResolvedValue(true) }; const redis = { isHealthy: jest.fn<Promise<boolean>, []>().mockResolvedValue(true) }; const storage = { isHealthy: jest.fn<Promise<boolean>, []>().mockResolvedValue(true) };
  const service = new HealthService(healthy as unknown as PrismaService, redis as unknown as RedisService, storage as unknown as ObjectStorageService);
  it('returns ready when each dependency is up', async () => { await expect(service.ready()).resolves.toMatchObject({ status: 'ok', dependencies: { postgres: 'up', redis: 'up', objectStorage: 'up' } }); });
  it('fails without exposing connection details when a dependency is down', async () => { redis.isHealthy.mockResolvedValueOnce(false); await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException); });
});
