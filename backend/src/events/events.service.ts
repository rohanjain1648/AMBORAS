import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import Redis from 'ioredis';
import { StoreEvent, EventType } from '../database/entities/store-event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface EventPayload {
  eventId: string;
  storeId: string;
  eventType: string;
  timestamp: Date;
  data: Record<string, any> | null;
}

@Injectable()
export class EventsService {
  // In-memory subject for SSE when Redis is not available
  private readonly eventSubject = new Subject<EventPayload>();

  // Redis subscriber for SSE when Redis is available
  private redisSub: Redis | null = null;

  constructor(
    @InjectRepository(StoreEvent)
    private readonly eventRepo: Repository<StoreEvent>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null,
  ) {
    if (this.redis) {
      // Create a dedicated subscriber connection
      this.redisSub = this.redis.duplicate();
      this.redisSub.subscribe('store_events').catch(() => {
        console.warn('⚠️  Redis subscribe failed — using in-memory events');
        this.redisSub = null;
      });
    }
  }

  /**
   * Ingest a new event
   */
  async createEvent(dto: CreateEventDto): Promise<EventPayload> {
    const event = this.eventRepo.create({
      eventId: dto.event_id,
      storeId: dto.store_id,
      eventType: dto.event_type as EventType,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      data: dto.data || null,
    });

    await this.eventRepo.save(event);

    const payload: EventPayload = {
      eventId: event.eventId,
      storeId: event.storeId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      data: event.data,
    };

    // Publish to Redis Pub/Sub (or in-memory fallback)
    if (this.redis) {
      try {
        await this.redis.publish('store_events', JSON.stringify(payload));
      } catch {
        this.eventSubject.next(payload);
      }
    } else {
      this.eventSubject.next(payload);
    }

    return payload;
  }

  /**
   * Get SSE observable for a specific store
   */
  getEventStream(storeId: string): Subject<EventPayload> {
    const storeSubject = new Subject<EventPayload>();

    if (this.redisSub) {
      // Listen to Redis Pub/Sub and filter by store
      const handler = (_channel: string, message: string) => {
        try {
          const event: EventPayload = JSON.parse(message);
          if (event.storeId === storeId) {
            storeSubject.next(event);
          }
        } catch {
          // Skip malformed messages
        }
      };
      this.redisSub.on('message', handler);

      // Cleanup when the subject completes
      storeSubject.subscribe({
        complete: () => {
          this.redisSub?.removeListener('message', handler);
        },
      });
    } else {
      // In-memory fallback
      const sub = this.eventSubject.subscribe((event) => {
        if (event.storeId === storeId) {
          storeSubject.next(event);
        }
      });

      storeSubject.subscribe({
        complete: () => sub.unsubscribe(),
      });
    }

    return storeSubject;
  }
}
