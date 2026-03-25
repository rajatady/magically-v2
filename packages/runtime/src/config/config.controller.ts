import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfigService } from './config.service.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getAll() {
    const c = this.config.getAll();
    return {
      ...c,
      openrouterApiKey: c.openrouterApiKey ? '***' : undefined,
      hasApiKey: !!c.openrouterApiKey,
    };
  }

  @Put()
  async update(@Body() body: UpdateConfigDto) {
    const updated = await this.config.update(body);
    return {
      ...updated,
      openrouterApiKey: updated.openrouterApiKey ? '***' : undefined,
      hasApiKey: !!updated.openrouterApiKey,
    };
  }
}
