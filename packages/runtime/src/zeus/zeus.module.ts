import { Module } from '@nestjs/common';
import { ZeusService } from './zeus.service.js';
import { ZeusController } from './zeus.controller.js';
import { LlmModule } from '../llm/llm.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  imports: [LlmModule, AgentsModule, EventsModule],
  providers: [ZeusService],
  controllers: [ZeusController],
  exports: [ZeusService],
})
export class ZeusModule {}
