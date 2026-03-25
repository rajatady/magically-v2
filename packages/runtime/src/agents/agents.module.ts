import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service.js';
import { AgentsController } from './agents.controller.js';
import { AgentUiService } from './agent-ui.service.js';
import { FunctionRunnerService } from './function-runner.service.js';
import { TriggerSchedulerService } from './trigger-scheduler.service.js';
import { EventsModule } from '../events/events.module.js';
import { LlmModule } from '../llm/llm.module.js';

@Module({
  imports: [EventsModule, LlmModule],
  providers: [AgentsService, AgentUiService, FunctionRunnerService, TriggerSchedulerService],
  controllers: [AgentsController],
  exports: [AgentsService, FunctionRunnerService],
})
export class AgentsModule {}
