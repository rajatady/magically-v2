import { Module } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { StorageService } from './storage.service';
import { RegistryController } from './registry.controller';

@Module({
  providers: [RegistryService, StorageService],
  controllers: [RegistryController],
  exports: [RegistryService],
})
export class RegistryModule {}
