import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AgentsService } from './agents.service';
import { FunctionRunnerService } from './function-runner.service';
import type { CronTrigger } from './types';

@Injectable()
export class TriggerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TriggerSchedulerService.name);

  constructor(
    private readonly agents: AgentsService,
    private readonly runner: FunctionRunnerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.registerAll();
  }

  /** Register cron jobs for all loaded agents. */
  registerAll() {
    for (const inst of this.agents.findAll()) {
      this.registerAgent(inst.manifest.id);
    }
  }

  /** Register all cron triggers for a single agent. */
  registerAgent(agentId: string) {
    const inst = this.agents.findOne(agentId);
    const triggers = inst.manifest.triggers ?? [];

    const cronTriggers = triggers.filter((t): t is CronTrigger => t.type === 'cron');
    if (cronTriggers.length === 0) return;

    for (const trigger of cronTriggers) {
      const jobName = `agent:${agentId}:${trigger.entrypoint}`;

      // Don't double-register
      if (this.schedulerRegistry.getCronJobs().has(jobName)) continue;

      const job = new CronJob(trigger.schedule, async () => {
        if (!inst.enabled) {
          this.logger.log(`Skipping ${agentId}/${trigger.entrypoint} — agent disabled`);
          return;
        }

        this.logger.log(`Cron firing: ${agentId}/${trigger.entrypoint} (${trigger.name})`);

        try {
          await this.runner.run(agentId, trigger.entrypoint, {
            type: 'schedule',
            source: trigger.schedule,
          });
        } catch (err: any) {
          this.logger.error(`Cron ${agentId}/${trigger.entrypoint} failed: ${err.message}`);
        }
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.logger.log(
        `Registered cron for ${agentId}: "${trigger.schedule}" → ${trigger.entrypoint} (${trigger.name})`,
      );
    }
  }

  /** Remove all cron jobs for an agent. */
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
