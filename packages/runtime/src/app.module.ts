import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module.js';
import { AppConfigModule } from './config/config.module.js';
import { LlmModule } from './llm/llm.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { EventsModule } from './events/events.module.js';
import { ZeusModule } from './zeus/zeus.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',                    // cwd (if running from root)
        '../../.env',              // monorepo root (if running from packages/runtime)
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule,
    AppConfigModule,
    LlmModule,
    AgentsModule,
    EventsModule,
    ZeusModule,
  ],
})
export class AppModule {}
