import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RegistryService } from './registry.service';
import { StorageService } from './storage.service';
import { RegistryController } from './registry.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-build' }),
  ],
  providers: [RegistryService, StorageService],
  controllers: [RegistryController],
  exports: [RegistryService, StorageService],
})
export class RegistryModule {}
