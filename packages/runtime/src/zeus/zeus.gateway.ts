import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { ZeusService } from './zeus.service';

/** Active execution per socket — allows interrupt */
const activeExecutions = new Map<string, AbortController>();

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/zeus',
})
export class ZeusGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ZeusGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly zeus: ZeusService,
  ) {}

  async handleConnection(client: Socket) {
    // Authenticate via handshake auth or query param
    const token =
      (client.handshake.auth as { token?: string })?.token ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      this.logger.warn(`Zeus client rejected (no token): ${client.id}`);
      client.emit('error', { message: 'Missing authentication' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.auth.verifyToken(token);
      (client as unknown as { userId: string }).userId = payload.sub;
      this.logger.log(`Zeus client connected: ${client.id} (user: ${payload.email})`);
    } catch {
      this.logger.warn(`Zeus client rejected (invalid token): ${client.id}`);
      client.emit('error', { message: 'Invalid authentication' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Abort any running execution for this socket
    const controller = activeExecutions.get(client.id);
    if (controller) {
      controller.abort();
      activeExecutions.delete(client.id);
    }
    this.logger.log(`Zeus client disconnected: ${client.id}`);
  }

  @SubscribeMessage('prompt')
  async handlePrompt(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { prompt: string; sessionId?: string },
  ) {
    const userId = (client as unknown as { userId: string }).userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!payload.prompt) {
      client.emit('error', { message: 'prompt is required' });
      return;
    }

    // Create conversation if none provided
    let sessionId = payload.sessionId;
    if (!sessionId) {
      const conv = await this.zeus.createConversation();
      sessionId = conv.id;
      client.emit('session', { sessionId });
    }

    // Abort any previous execution for this socket
    const prev = activeExecutions.get(client.id);
    if (prev) prev.abort();

    const abortController = new AbortController();
    activeExecutions.set(client.id, abortController);

    try {
      const { fullResponse, blocks } = await this.zeus.runPrompt(sessionId, payload.prompt, userId, {
        onChunk: (text) => client.emit('chunk', { text }),
        onToolStart: (id, tool, input) => client.emit('tool:start', { id, tool, input }),
        onToolResult: (id, result) => client.emit('tool:result', { id, result }),
        onStatus: (status) => client.emit('status', { status }),
        onResult: (result) => client.emit('result', result),
        onError: (message) => client.emit('error', { message }),
        onDone: () => client.emit('done', { sessionId }),
      }, abortController);

      // Persist both user message and assistant response
      await this.zeus.appendMessages(sessionId, [
        { role: 'user', content: payload.prompt },
        { role: 'assistant', content: fullResponse, blocks },
      ]).catch((err) => this.logger.error('Failed to persist messages', err));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'aborted') {
        client.emit('error', { message });
      }
    } finally {
      activeExecutions.delete(client.id);
    }
  }

  @SubscribeMessage('interrupt')
  handleInterrupt(@ConnectedSocket() client: Socket) {
    const controller = activeExecutions.get(client.id);
    if (controller) {
      controller.abort();
      activeExecutions.delete(client.id);
      client.emit('interrupted');
      this.logger.log(`Zeus execution interrupted for ${client.id}`);
    }
  }
}
