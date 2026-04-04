import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';

@Module({
  providers: [EventsGateway, FeedService, WidgetService],
  controllers: [FeedController, WidgetController],
  exports: [EventsGateway, FeedService, WidgetService],
})
export class EventsModule {}
