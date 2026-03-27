import { Module } from '@nestjs/common';
import { ZeusService } from './zeus.service';
import { ZeusController } from './zeus.controller';
import { AgentsModule } from '../agents/agents.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AgentsModule, EventsModule],
  providers: [ZeusService],
  controllers: [ZeusController],
  exports: [ZeusService],
})
export class ZeusModule {}
