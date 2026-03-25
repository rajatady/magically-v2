import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeedService, CreateFeedItemDto } from './feed.service.js';

@Controller('api/feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.feed.findAll(limit ? parseInt(limit, 10) : 50);
  }

  @Post()
  create(@Body() body: CreateFeedItemDto) {
    return this.feed.create(body);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string) {
    this.feed.markRead(id);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@Param('id') id: string) {
    this.feed.dismiss(id);
  }
}
