import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthDependencies, ReadinessFailureResponse, ReadinessResponse } from '@eventflow/contracts';
import { ObjectStorageService } from '../infrastructure/object-storage.service'; import { RedisService } from '../infrastructure/redis.service'; import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly objectStorage: ObjectStorageService) {}
  live(): { status: 'ok'; service: 'eventflow-api'; timestamp: string } { return { status: 'ok', service: 'eventflow-api', timestamp: new Date().toISOString() }; }
  async ready(): Promise<ReadinessResponse> {
    const [postgresReady, redisReady, storageReady] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy(), this.objectStorage.isHealthy()]);
    const dependencies: HealthDependencies = { postgres: postgresReady ? 'up' : 'down', redis: redisReady ? 'up' : 'down', objectStorage: storageReady ? 'up' : 'down' };
    const timestamp = new Date().toISOString();
    if (!postgresReady || !redisReady || !storageReady) {
      const response: ReadinessFailureResponse = { status: 'error', service: 'eventflow-api', timestamp, dependencies };
      throw new ServiceUnavailableException(response);
    }
    return { status: 'ok', service: 'eventflow-api', timestamp, dependencies };
  }
}
