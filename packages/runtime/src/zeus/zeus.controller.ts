import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZeusService } from './zeus.service';
import { SetMemoryDto } from './dto/memory.dto';

@Controller('api/zeus')
export class ZeusController {
  constructor(private readonly zeus: ZeusService) {}

  /**
   * POST /api/zeus/chat — SSE streaming via Agent SDK.
   * Primary chat is via Socket.IO (ZeusGateway), this is a fallback/compatibility endpoint.
   */
  @Post('chat')
  async chat(@Body() body: { prompt: string; sessionId?: string }, @Req() req: Request, @Res() res: Response) {
    const userId = req.user!.sub;
    const prompt = body.prompt;
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // Create conversation if none provided
    let sessionId = body.sessionId;
    if (!sessionId) {
      const conv = await this.zeus.createConversation();
      sessionId = conv.id;
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    await this.zeus.runPrompt(sessionId, prompt, userId, {
      onChunk: (text) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      },
      onToolStart: (id, tool, input) => {
        res.write(`data: ${JSON.stringify({ type: 'tool:start', id, tool, input })}\n\n`);
      },
      onToolResult: (id, result) => {
        res.write(`data: ${JSON.stringify({ type: 'tool:result', id, result })}\n\n`);
      },
      onStatus: (status) => {
        res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
      },
      onResult: (result) => {
        res.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);
      },
      onError: (message) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      },
      onDone: () => {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      },
    }, abortController);
  }

  // ─── Conversations ──────────────────────────────────────────────────

  @Post('conversations')
  async createConversation(@Body() body: { mode?: 'chat' | 'build' | 'edit' | 'task' }) {
    return this.zeus.createConversation(body.mode ?? 'chat');
  }

  @Get('conversations')
  async listConversations() {
    return this.zeus.listConversations();
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conv = await this.zeus.getConversation(id);
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Param('id') id: string) {
    await this.zeus.deleteConversation(id);
  }

  // ─── Memory ─────────────────────────────────────────────────────────

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

  // ─── Tasks ──────────────────────────────────────────────────────────

  @Get('tasks')
  async getTasks() {
    return this.zeus.getTasks();
  }
}
