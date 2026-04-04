import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentUiService } from './agent-ui.service';
import { FunctionRunnerService } from './function-runner.service';
import { LocalRunnerService } from './local-runner.service';
import { LocalDiscoveryService } from './local-discovery.service';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { TriggerSchedulerService } from './trigger-scheduler.service';
import { EventsModule } from '../events/events.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [EventsModule, LlmModule],
  providers: [AgentsService, AgentUiService, FunctionRunnerService, LocalRunnerService, LocalDiscoveryService, ScheduleService, TriggerSchedulerService],
  controllers: [AgentsController, ScheduleController],
  exports: [AgentsService, FunctionRunnerService, LocalRunnerService, ScheduleService, TriggerSchedulerService],
})
export class AgentsModule {}
