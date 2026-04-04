import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import { userSchedules } from '../db/schema';

export interface CreateScheduleDto {
  userId: string;
  agentId: string;
  functionName: string;
  cron: string;
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(@InjectDB() private readonly db: DrizzleDB) {}

  async create(dto: CreateScheduleDto) {
    const now = new Date();
    const schedule = {
      id: randomUUID(),
      userId: dto.userId,
      agentId: dto.agentId,
      functionName: dto.functionName,
      cron: dto.cron,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(userSchedules).values(schedule);
    this.logger.log(`Created schedule: ${dto.agentId}/${dto.functionName} "${dto.cron}" for user ${dto.userId}`);
    return schedule;
  }

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(userSchedules)
      .where(eq(userSchedules.userId, userId));
  }

  async findAllEnabled() {
    return this.db
      .select()
      .from(userSchedules)
      .where(eq(userSchedules.enabled, true));
  }

  async toggle(id: string, enabled: boolean) {
    const now = new Date();
    await this.db
      .update(userSchedules)
      .set({ enabled, updatedAt: now })
      .where(eq(userSchedules.id, id));
  }

  async updateCron(id: string, cron: string) {
    const now = new Date();
    await this.db
      .update(userSchedules)
      .set({ cron, updatedAt: now })
      .where(eq(userSchedules.id, id));
  }

  async updateLastRun(id: string) {
    await this.db
      .update(userSchedules)
      .set({ lastRunAt: new Date() })
      .where(eq(userSchedules.id, id));
  }

  async remove(id: string) {
    await this.db
      .delete(userSchedules)
      .where(eq(userSchedules.id, id));
  }
}
