import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';

@Module({
  providers: [EventsGateway, FeedService],
  controllers: [FeedController],
  exports: [EventsGateway, FeedService],
})
export class EventsModule {}
