import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { WidgetService } from './widget.service';

@Controller('api/widgets')
export class WidgetController {
  constructor(private readonly widgets: WidgetService) {}

  @Get()
  findAll(@Req() req: Request) {
    const userId = req.user!.sub;
    return this.widgets.findByUser(userId);
  }

  @Post()
  upsert(@Req() req: Request, @Body() body: { agentId: string; size: string; html: string }) {
    const userId = req.user!.sub;
    return this.widgets.upsert({
      userId,
      agentId: body.agentId,
      size: body.size,
      html: body.html,
    });
  }

  @Delete(':agentId')
  remove(@Req() req: Request, @Param('agentId') agentId: string) {
    const userId = req.user!.sub;
    return this.widgets.remove(userId, agentId);
  }
}
