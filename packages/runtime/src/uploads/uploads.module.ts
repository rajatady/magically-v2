import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [RegistryModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
