import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { AppConfigModule } from './config/config.module';
import { LlmModule } from './llm/llm.module';
import { AgentsModule } from './agents/agents.module';
import { EventsModule } from './events/events.module';
import { ZeusModule } from './zeus/zeus.module';
import { AuthModule } from './auth';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '../../.env',
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule,
    AuthModule,
    AppConfigModule,
    LlmModule,
    AgentsModule,
    EventsModule,
    ZeusModule,
  ],
})
export class AppModule {}
