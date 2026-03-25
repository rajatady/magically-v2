import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RegistryService } from './registry.service';

@Controller('api/registry')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Post('publish')
  async publish(@Req() req: any, @Body() body: { manifest: Record<string, any> }) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.registry.publish(userId, body.manifest);
  }

  @Get('agents')
  async listAgents(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.registry.listAgents({
      category,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('agents/:id')
  async getAgent(@Param('id') id: string) {
    return this.registry.getAgent(id);
  }

  @Get('agents/:id/versions/:version')
  async getVersion(@Param('id') id: string, @Param('version') version: string) {
    return this.registry.getVersion(id, version);
  }

  @Post('agents/:id/install')
  async install(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.registry.install(userId, id);
  }

  @Delete('agents/:id/uninstall')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id ?? req.user?.sub;
    await this.registry.uninstall(userId, id);
  }

  @Get('installs')
  async listInstalls(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.registry.listInstalls(userId);
  }

  @Get('installs/:agentId')
  async getInstall(@Req() req: any, @Param('agentId') agentId: string) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.registry.getInstall(userId, agentId);
  }

  @Put('installs/:agentId/config')
  async updateConfig(
    @Req() req: any,
    @Param('agentId') agentId: string,
    @Body() config: Record<string, unknown>,
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    await this.registry.updateConfig(userId, agentId, config);
    return { ok: true };
  }
}
