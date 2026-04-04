import { Controller, Get, Post, Put, Delete, Body, Param, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ScheduleService } from './schedule.service';
import { TriggerSchedulerService } from './trigger-scheduler.service';

@Controller('api/schedules')
export class ScheduleController {
  constructor(
    private readonly schedules: ScheduleService,
    private readonly scheduler: TriggerSchedulerService,
  ) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.schedules.findByUser(req.user!.sub);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: { agentId: string; functionName: string; cron: string }) {
    const schedule = await this.schedules.create({
      userId: req.user!.sub,
      agentId: body.agentId,
      functionName: body.functionName,
      cron: body.cron,
    });
    await this.scheduler.refresh();
    return schedule;
  }

  @Put(':id/toggle')
  async toggle(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    await this.schedules.toggle(id, body.enabled);
    await this.scheduler.refresh();
  }

  @Put(':id/cron')
  async updateCron(@Param('id') id: string, @Body() body: { cron: string }) {
    await this.schedules.updateCron(id, body.cron);
    await this.scheduler.refresh();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.schedules.remove(id);
    await this.scheduler.refresh();
  }
}
