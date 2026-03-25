import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export type MagicallyEvent =
  | { type: 'agent:update'; agentId: string; data: unknown }
  | { type: 'feed:new'; item: unknown }
  | { type: 'zeus:typing'; conversationId: string }
  | { type: 'zeus:chunk'; conversationId: string; content: string }
  | { type: 'zeus:done'; conversationId: string; message: string }
  | { type: 'agent:build:log'; agentId: string; log: string; level: 'info' | 'error' | 'success' }
  | { type: 'task:update'; taskId: string; status: string; result?: unknown };

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Broadcast to all connected clients */
  emit(event: MagicallyEvent) {
    this.server.emit(event.type, event);
  }

  // Internal event bus listeners — NestJS EventEmitter bridges to WS

  @OnEvent('feed.new')
  onFeedNew(item: unknown) {
    this.emit({ type: 'feed:new', item });
  }

  @OnEvent('agent.update')
  onAgentUpdate(payload: { agentId: string; data: unknown }) {
    this.emit({ type: 'agent:update', agentId: payload.agentId, data: payload.data });
  }
}
