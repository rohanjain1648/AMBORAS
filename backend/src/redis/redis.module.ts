import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis | null => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          console.log('⚠️  Redis URL not configured — running without cache');
          return null;
        }
        try {
          const client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
              if (times > 3) {
                console.warn('⚠️  Redis unavailable — falling back to no cache');
                return null;
              }
              return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
          });
          client.connect().catch(() => {
            console.warn('⚠️  Redis connection failed — running without cache');
          });
          return client;
        } catch {
          console.warn('⚠️  Redis initialization failed — running without cache');
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy() {
    // Redis cleanup handled by NestJS lifecycle
  }
}
