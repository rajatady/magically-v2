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
} from '@nestjs/common';
import { Response } from 'express';
import { ZeusService } from './zeus.service';
import { ChatDto } from './dto/chat.dto';
import { SetMemoryDto } from './dto/memory.dto';

@Controller('api/zeus')
export class ZeusController {
  constructor(private readonly zeus: ZeusService) {}

  /** POST /api/zeus/chat — SSE streaming response */
  @Post('chat')
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    let convId = body.conversationId;
    if (!convId) {
      const conv = this.zeus.createConversation(body.mode);
      convId = conv.id;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Conversation-Id', convId);
    res.flushHeaders();

    try {
      for await (const chunk of this.zeus.chat(convId, body.message)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('conversations')
  createConversation(@Body() body: { mode?: 'chat' | 'build' | 'edit' | 'task' }) {
    return this.zeus.createConversation(body.mode ?? 'chat');
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string) {
    const conv = this.zeus.getConversation(id);
    if (!conv) return { error: 'Not found' };
    return conv;
  }

  @Get('memory')
  getMemory() {
    return this.zeus.getMemory();
  }

  @Post('memory')
  @HttpCode(HttpStatus.OK)
  setMemory(@Body() body: SetMemoryDto) {
    this.zeus.setMemory(body.key, body.value, body.category, body.source ?? 'user');
    return { ok: true };
  }

  @Delete('memory/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMemory(@Param('key') key: string) {
    this.zeus.deleteMemory(key);
  }

  @Get('tasks')
  getTasks() {
    return this.zeus.getTasks();
  }
}
