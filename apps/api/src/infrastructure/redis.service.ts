import { Injectable, OnModuleDestroy } from '@nestjs/common'; import { ConfigService } from '@nestjs/config'; import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  constructor(config: ConfigService) { this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500, enableOfflineQueue: false }); }
  async isHealthy(): Promise<boolean> { try { if (this.client.status === 'wait') await this.client.connect(); return (await this.client.ping()) === 'PONG'; } catch { return false; } }
  async incrementWithExpiry(key: string, expirySeconds: number): Promise<number | null> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, expirySeconds);
      return count;
    } catch {
      return null;
    }
  }
  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit().catch(() => undefined);
      return;
    }
    this.client.disconnect();
  }
}
