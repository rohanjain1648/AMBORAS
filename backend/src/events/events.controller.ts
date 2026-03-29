import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Sse,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, map } from 'rxjs';
import { Response, Request } from 'express';
import { EventsService, EventPayload } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { StoreId } from '../auth/store.decorator';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * POST /api/v1/events
   * Ingest a new store event (public — used by store frontends)
   */
  @Post()
  async createEvent(@Body() dto: CreateEventDto) {
    const event = await this.eventsService.createEvent(dto);
    return {
      success: true,
      event,
    };
  }

  /**
   * GET /api/v1/events/stream
   * SSE stream of real-time events for the authenticated store
   */
  @Get('stream')
  @UseGuards(AuthGuard('jwt'))
  @Sse()
  streamEvents(@StoreId() storeId: string): Observable<MessageEvent> {
    const eventStream = this.eventsService.getEventStream(storeId);

    return eventStream.pipe(
      map((event: EventPayload) => ({
        data: JSON.stringify(event),
        id: event.eventId,
        type: 'event',
      })),
    );
  }
}
