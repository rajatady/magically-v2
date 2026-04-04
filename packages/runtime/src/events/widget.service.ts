import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import { userWidgets } from '../db/schema';

export interface UpsertWidgetDto {
  userId: string;
  agentId: string;
  size: string;
  html: string;
}

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(@InjectDB() private readonly db: DrizzleDB) {}

  async upsert(dto: UpsertWidgetDto) {
    const existing = await this.db
      .select()
      .from(userWidgets)
      .where(and(
        eq(userWidgets.userId, dto.userId),
        eq(userWidgets.agentId, dto.agentId),
      ))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      await this.db
        .update(userWidgets)
        .set({ html: dto.html, size: dto.size, updatedAt: now })
        .where(eq(userWidgets.id, existing[0].id));

      this.logger.log(`Updated widget for ${dto.agentId}`);
      return { ...existing[0], html: dto.html, size: dto.size, updatedAt: now };
    }

    const widget = {
      id: randomUUID(),
      userId: dto.userId,
      agentId: dto.agentId,
      size: dto.size,
      html: dto.html,
      position: 0,
      updatedAt: now,
    };

    await this.db.insert(userWidgets).values(widget);
    this.logger.log(`Created widget for ${dto.agentId}`);
    return widget;
  }

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(userWidgets)
      .where(eq(userWidgets.userId, userId));
  }

  async remove(userId: string, agentId: string) {
    await this.db
      .delete(userWidgets)
      .where(and(
        eq(userWidgets.userId, userId),
        eq(userWidgets.agentId, agentId),
      ));
  }
}
