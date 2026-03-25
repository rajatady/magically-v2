import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway.js';
import { FeedService } from './feed.service.js';
import { FeedController } from './feed.controller.js';

@Module({
  providers: [EventsGateway, FeedService],
  controllers: [FeedController],
  exports: [EventsGateway, FeedService],
})
export class EventsModule {}
