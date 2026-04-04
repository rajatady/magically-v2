import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { FunctionRunnerService } from './function-runner.service';
import { ScheduleService } from './schedule.service';

@Injectable()
export class TriggerSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TriggerSchedulerService.name);

  constructor(
    private readonly runner: FunctionRunnerService,
    private readonly scheduleService: ScheduleService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.registerAll();
  }

  async registerAll() {
    // Clear existing jobs
    for (const name of this.schedulerRegistry.getCronJobs().keys()) {
      if (name.startsWith('schedule:')) {
        this.schedulerRegistry.deleteCronJob(name);
      }
    }

    const schedules = await this.scheduleService.findAllEnabled();
    for (const schedule of schedules) {
      this.registerSchedule(schedule);
    }

    this.logger.log(`Registered ${schedules.length} user schedule(s)`);
  }

  registerSchedule(schedule: { id: string; userId: string; agentId: string; functionName: string; cron: string }) {
    const jobName = `schedule:${schedule.id}`;

    if (this.schedulerRegistry.getCronJobs().has(jobName)) return;

    const job = new CronJob(schedule.cron, async () => {
      this.logger.log(`Schedule firing: ${schedule.agentId}/${schedule.functionName} for user ${schedule.userId}`);

      try {
        await this.runner.run(schedule.agentId, schedule.functionName, {
          type: 'schedule',
          source: schedule.cron,
        }, schedule.userId);

        await this.scheduleService.updateLastRun(schedule.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Schedule ${schedule.agentId}/${schedule.functionName} failed: ${message}`);
      }
    });

    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();

    this.logger.log(`Registered: ${schedule.agentId}/${schedule.functionName} "${schedule.cron}" (user: ${schedule.userId})`);
  }

  /** Call after creating/updating/deleting a schedule to refresh cron jobs */
  async refresh() {
    await this.registerAll();
  }
}
