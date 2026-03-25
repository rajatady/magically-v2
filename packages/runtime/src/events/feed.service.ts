import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import { feedEvents, type NewFeedEvent } from '../db/schema';

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
    @InjectDB() private readonly db: DrizzleDB,
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

    await this.db.insert(feedEvents).values(item);

    // Emit to event bus → WebSocket gateway picks it up
    this.emitter.emit('feed.new', item);

    return item;
  }

  async findAll(limit = 50) {
    return this.db
      .select()
      .from(feedEvents)
      .orderBy(desc(feedEvents.createdAt))
      .limit(limit);
  }

  async markRead(id: string) {
    await this.db
      .update(feedEvents)
      .set({ read: true })
      .where(eq(feedEvents.id, id));
  }

  async dismiss(id: string) {
    await this.db
      .delete(feedEvents)
      .where(eq(feedEvents.id, id));
  }
}
