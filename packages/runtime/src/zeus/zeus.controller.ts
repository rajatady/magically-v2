import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { pipeUIMessageStreamToResponse, type UIMessage } from 'ai';
import { ZeusService } from './zeus.service';
import { SetMemoryDto } from './dto/memory.dto';
import { chatRequestSchema } from './schema';

@Controller('api/zeus')
export class ZeusController {
  constructor(private readonly zeus: ZeusService) {}

  /** POST /api/zeus/chat — Vercel AI SDK streaming (useChat compatible) */
  @Post('chat')
  async chat(@Body() body: unknown, @Res() res: Response) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { messages, conversationId } = parsed.data;
    const stream = await this.zeus.streamChat(messages as UIMessage[], conversationId);
    pipeUIMessageStreamToResponse({ stream, response: res });
  }

  @Post('conversations')
  async createConversation(@Body() body: { mode?: 'chat' | 'build' | 'edit' | 'task' }) {
    return this.zeus.createConversation(body.mode ?? 'chat');
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conv = await this.zeus.getConversation(id);
    if (!conv) return { error: 'Not found' };
    return conv;
  }

  @Get('memory')
  async getMemory() {
    return this.zeus.getMemory();
  }

  @Post('memory')
  @HttpCode(HttpStatus.OK)
  async setMemory(@Body() body: SetMemoryDto) {
    await this.zeus.setMemory(body.key, body.value, body.category, body.source ?? 'user');
    return { ok: true };
  }

  @Delete('memory/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMemory(@Param('key') key: string) {
    await this.zeus.deleteMemory(key);
  }

  @Get('tasks')
  async getTasks() {
    return this.zeus.getTasks();
  }
}
