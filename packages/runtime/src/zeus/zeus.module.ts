import { Module } from '@nestjs/common';
import { ZeusService } from './zeus.service';
import { ZeusController } from './zeus.controller';
import { ZeusGateway } from './zeus.gateway';
import { AgentsModule } from '../agents/agents.module';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth';

@Module({
  imports: [AgentsModule, EventsModule, AuthModule],
  providers: [ZeusService, ZeusGateway],
  controllers: [ZeusController],
  exports: [ZeusService],
})
export class ZeusModule {}
