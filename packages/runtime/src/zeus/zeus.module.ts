import { Module } from '@nestjs/common';
import { ZeusService } from './zeus.service';
import { ZeusController } from './zeus.controller';
import { LlmModule } from '../llm/llm.module';
import { AgentsModule } from '../agents/agents.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [LlmModule, AgentsModule, EventsModule],
  providers: [ZeusService],
  controllers: [ZeusController],
  exports: [ZeusService],
})
export class ZeusModule {}
