import { Module } from '@nestjs/common';
import { LlmService } from './llm.service.js';
import { AppConfigModule } from '../config/config.module.js';

@Module({
  imports: [AppConfigModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
