import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { DbModule } from './db/db.module';
import { AppConfigModule } from './config/config.module';
import { LlmModule } from './llm/llm.module';
import { AgentsModule } from './agents/agents.module';
import { EventsModule } from './events/events.module';
import { ZeusModule } from './zeus/zeus.module';
import { AuthModule } from './auth';
import { RegistryModule } from './registry/registry.module';
import { BuildModule } from './build/build.module';
import { UploadsModule } from './uploads/uploads.module';

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
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    DbModule,
    AuthModule,
    AppConfigModule,
    LlmModule,
    AgentsModule,
    EventsModule,
    ZeusModule,
    RegistryModule,
    BuildModule,
    UploadsModule,
  ],
})
export class AppModule {}
