import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AgentsService } from './agents.service';
import { FunctionRunnerService } from './function-runner.service';

@Injectable()
export class TriggerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TriggerSchedulerService.name);

  constructor(
    private readonly agents: AgentsService,
    private readonly runner: FunctionRunnerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.registerAll();
  }

  async registerAll() {
    const allAgents = await this.agents.findAll();
    for (const agent of allAgents) {
      this.registerAgent(agent.id, agent.manifest);
    }
  }

  registerAgent(agentId: string, manifest: Record<string, unknown>) {
    const triggers = (manifest.triggers ?? []) as Array<{
      type: string;
      name: string;
      entrypoint: string;
      schedule?: string;
    }>;

    const cronTriggers = triggers.filter((t) => t.type === 'cron' && t.schedule);
    if (cronTriggers.length === 0) return;

    for (const trigger of cronTriggers) {
      const jobName = `agent:${agentId}:${trigger.entrypoint}`;

      if (this.schedulerRegistry.getCronJobs().has(jobName)) continue;

      const job = new CronJob(trigger.schedule!, async () => {
        this.logger.log(`Cron firing: ${agentId}/${trigger.entrypoint} (${trigger.name})`);

        try {
          await this.runner.run(agentId, trigger.entrypoint, {
            type: 'schedule',
            source: trigger.schedule,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Cron ${agentId}/${trigger.entrypoint} failed: ${message}`);
        }
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.logger.log(
        `Registered cron for ${agentId}: "${trigger.schedule}" → ${trigger.entrypoint} (${trigger.name})`,
      );
    }
  }

  unregisterAgent(agentId: string) {
    const jobs = this.schedulerRegistry.getCronJobs();
    const prefix = `agent:${agentId}:`;

    for (const name of jobs.keys()) {
      if (name.startsWith(prefix)) {
        this.schedulerRegistry.deleteCronJob(name);
        this.logger.log(`Unregistered cron: ${name}`);
      }
    }
  }
}
