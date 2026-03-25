import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentUiService } from './agent-ui.service';
import { FunctionRunnerService } from './function-runner.service';
import { TriggerSchedulerService } from './trigger-scheduler.service';
import { EventsModule } from '../events/events.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [EventsModule, LlmModule],
  providers: [AgentsService, AgentUiService, FunctionRunnerService, TriggerSchedulerService],
  controllers: [AgentsController],
  exports: [AgentsService, FunctionRunnerService],
})
export class AgentsModule {}
