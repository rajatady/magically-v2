import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
