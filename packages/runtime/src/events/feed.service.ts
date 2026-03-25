import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../db/database.service.js';
import { feedEvents, type NewFeedEvent } from '../db/schema.js';

export type FeedItemType = 'info' | 'success' | 'warning' | 'error' | 'audio';

export interface CreateFeedItemDto {
  agentId?: string;
  type: FeedItemType;
  title: string;
  body?: string;
  data?: unknown;
  audioUrl?: string;
}

@Injectable()
export class FeedService {
  constructor(
    private readonly db: DatabaseService,
    private readonly emitter: EventEmitter2,
  ) {}

  async create(dto: CreateFeedItemDto) {
    const item: NewFeedEvent = {
      id: randomUUID(),
      agentId: dto.agentId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data,
      audioUrl: dto.audioUrl,
      read: false,
      createdAt: new Date(),
    };

    this.db.db.insert(feedEvents).values(item).run();

    // Emit to event bus → WebSocket gateway picks it up
    this.emitter.emit('feed.new', item);

    return item;
  }

  findAll(limit = 50) {
    return this.db.db
      .select()
      .from(feedEvents)
      .orderBy(desc(feedEvents.createdAt))
      .limit(limit)
      .all();
  }

  markRead(id: string) {
    this.db.db
      .update(feedEvents)
      .set({ read: true })
      .where(eq(feedEvents.id, id))
      .run();
  }

  dismiss(id: string) {
    this.db.db
      .delete(feedEvents)
      .where(eq(feedEvents.id, id))
      .run();
  }
}
